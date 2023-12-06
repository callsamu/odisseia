import { Node } from '@tiptap/core';
import { mergeAttributes } from '@tiptap/core';
import { Text } from '@tiptap/extension-text';
import { EditorProvider, Extension, useCurrentEditor } from '@tiptap/react';
import './index.css';
import { Editor } from '@tiptap/core';
import { findParentDomRefOfType } from 'prosemirror-utils';
import { Fragment, ResolvedPos } from '@tiptap/pm/model';
import { EditorState, Plugin, Transaction } from '@tiptap/pm/state';
import { Node as NodePM } from '@tiptap/pm/model'
import { v4 as uuid } from 'uuid';
import { TextAlign } from '@tiptap/extension-text-align';
import { Paragraph } from '@tiptap/extension-paragraph';
import { Heading } from '@tiptap/extension-heading';
import { Button, Space } from 'antd';
import ButtonGroup from 'antd/es/button/button-group';


const Doc = Node.create({
	name: 'document',
	topNode: true,
	content: 'page+',
});

const Page = Node.create({
  name: 'page',

  priority: 1000,

  addOptions() {
    return {
      HTMLAttributes: {
				class: 'page',
			},
    }
  },

  group: 'page',
  content: 'body',

  parseHTML() {
    return [
      { 
				tag: 'div' ,
				attrs: {
					class: "page",
				}
			},
    ]
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(this.options.HTMLAttributes, HTMLAttributes), 0]
  },
});

const Body = Node.create({
  name: 'body',

  priority: 1000,

  addOptions() {
    return {
      HTMLAttributes: {
				class: 'page-body',
			},
    }
  },

  group: 'body',
  content: 'block*',

  parseHTML() {
    return [
      { 
				tag: 'div' ,
				attrs: {
					class: "page-body",
				}
			},
    ]
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(this.options.HTMLAttributes, HTMLAttributes), 0]
  },
});

const CONTENT_NODES = [Paragraph.name, Heading.name];

interface FontData {
	family: string;
	size: string;
	weight: string;
}

class TextMeasurer {
	canvas: HTMLCanvasElement;
	ctx: CanvasRenderingContext2D;
	paragraphData: FontData;

	static CSS(element: Element, prop: string): string {
		return getComputedStyle(element).getPropertyValue(prop);
	}

	constructor() {
		this.canvas = document.createElement('canvas');
		this.ctx = this.canvas.getContext('2d')!;

		const p = document.querySelector('.tiptap p');
		if (!p) throw new Error('Failed to get paragraph element');

		this.paragraphData = {
			family: TextMeasurer.CSS(p, 'font-family'),
			size: TextMeasurer.CSS(p, 'font-size'),
			weight: TextMeasurer.CSS(p, 'font-weight'),
		};
	}

	font(type: FontData) {
		this.ctx.font = `${type.weight} ${type.size} ${type.family}`;
	}

	paragraph(text: string): TextMetrics {
		this.font(this.paragraphData);
		return this.ctx.measureText(text);
	}
}

class Paginator {
	constructor(
		private deleting: boolean,
		private state: EditorState,
		private pagesLastLinePositions: Map<string, number>,
		private bodyDimensions: DOMRect,
	) {}

	public joinDocument(tr: Transaction): Transaction {
		while (tr.doc.childCount > 1) {
			if (tr.doc.firstChild) tr.join(tr.doc.firstChild.nodeSize, 2);
		}
		return tr;
	}

	public splitDocument(tr: Transaction, split?: ResolvedPos): Transaction {
		if (!split) {
			const s = this.findSplitNodePos(tr.doc);
			if (!s) return tr;
			split = s;
		}

		let newTr = this.splitPage(tr, split);

		const after = this.findSplitNodePos(newTr.doc);
		if (after) {
			return this.splitDocument(newTr, after);
		}

		return newTr;
	}

	private splitPage(tr: Transaction, $pos: ResolvedPos): Transaction {
		const { pos, depth } = $pos;

		let paragraphSplitPos = -1;

		let paragraph = $pos.doc.nodeAt(pos);
		if (!paragraph) return tr;

		const bodyOfPage = $pos.parent;
		const contents: NodePM[] = [];

		if (paragraph.attrs.id && !this.deleting) {
			const id = paragraph.attrs.id;
			const position = this.pagesLastLinePositions.get(id);
			paragraphSplitPos = position || -1;
		}

		if (paragraphSplitPos > 0) {
			const text = this.state.doc.textBetween(paragraphSplitPos - 1, $pos.end());
			console.log(text);
			const frag = Fragment.from(this.state.schema.text(text));
			contents.push(paragraph.copy(frag));
		} else {
			contents.push(paragraph);
		}

		bodyOfPage.forEach((node, nodePos) => {
			if (nodePos > $pos.parentOffset) {
				contents.push(node);
			}
		});

		const body = $pos.node(depth).copy(Fragment.from(contents));
		const page = this.state.schema.nodes['page'].create(null, body);

		const end = $pos.doc.resolve(0).end();
		const splitPosition = paragraphSplitPos > 0 ? paragraphSplitPos : pos;
		return tr.replaceWith(splitPosition - 1, end, page);
	}

	private findSplitNodePos(doc: NodePM): ResolvedPos | null {
		let split!: ResolvedPos;
		let height = 0;

		const lastChild = doc.lastChild;
		if (!lastChild) return null;

		doc.descendants((node, pos) => {
			if (height > this.bodyDimensions.height) {
				return false;
			}

			const type = node.type.name;

			if (type === 'page' && node !== lastChild) {
				return false;
			}

			if (CONTENT_NODES.includes(type)) {
				const element = document.getElementById(node.attrs.id);
				if (!element) throw new Error(`Failed to get element with id ${node.attrs.id}`);

				const dimensions = element.getBoundingClientRect();
				height += dimensions.height;

				if (height > this.bodyDimensions.height) {
					split = doc.resolve(pos);
				}

				return false;
			}

			return true;
		});

		return split ? split : null;
	}
}

const isOverflown = ({ clientWidth, clientHeight, scrollWidth, scrollHeight }: HTMLElement) => {
  return scrollHeight > clientHeight || scrollWidth > clientWidth
}

const ProseMirrorUniqueID = (generator = uuid) => {
	return new Plugin({
		appendTransaction: (transactions, _, newState) => {
			const tr = newState.tr;
			let modified = false;

			const set = new Set<string>();

			if (transactions.some(t => t.docChanged)) {
				tr.doc.descendants((node, pos) => {
					if (CONTENT_NODES.includes(node.type.name)) {
						if (!node.attrs.id) {
							const id = generator()
							tr.setNodeMarkup(pos, undefined, { ...node.attrs, id: id });
							modified = true;
						} else if (set.has(node.attrs.id)) {
							const id = generator()
							tr.setNodeMarkup(pos, undefined, { ...node.attrs, id: id });
							modified = true;
						} else {
							set.add(node.attrs.id);
						}
					}
				});
			}

			return modified ? tr : null;
		},
	})
}

const UniqueID: Extension = Extension.create<any>({
	name: 'unique-id',
	addProseMirrorPlugins() {
		return [
			ProseMirrorUniqueID(),
		]
	},
	addGlobalAttributes() {
		return [{
			types: [
				Paragraph.name,
				Heading.name,
			],
			attributes: {
				id: {
					default: null,
					parseHTML: (element: Element) => element.getAttribute('id'),
					renderHTML: (attributes: any) => {
						return { id: attributes.id };
					},
				},
			},
		}];
	}
})

interface PagingStorage {
	previousState: EditorState | null;
	pagesLastLinePositions: Map<string, number>;
};

const Paging: Extension = Extension.create<{}, PagingStorage>({
	name: 'paging',

	addStorage() {
		return {
			previousState: null,
			pagesLastLinePositions: new Map(),
		}
	},

	// @ts-ignore
  onUpdate({ editor }: { editor: Editor }): void {
		const { schema, selection } = editor.state;

		let newTr = editor.state.tr;

		const domAtPos = editor.view.domAtPos.bind(editor.view);
		const bodyDOM = findParentDomRefOfType(schema.nodes['body'], domAtPos)(selection);
		const bodyElement = bodyDOM as HTMLElement;

		let deleting = false;

		if (this.storage.previousState) {
			const prev = this.storage.previousState;
			if (selection.$anchor.node(2) && prev.selection.$anchor.node(2))
				deleting = newTr.doc.nodeSize < prev.doc.nodeSize
		}

		const inserting = isOverflown(bodyElement);

		if (inserting || deleting) {
			const rect = bodyElement.getBoundingClientRect();
			const pllp = this.storage.pagesLastLinePositions;
			const paginator = new Paginator(deleting, editor.state, pllp, rect);

			newTr = paginator.joinDocument(newTr);
			newTr = paginator.splitDocument(newTr);
			newTr = newTr.scrollIntoView();
			const state = editor.state.apply(newTr);
			editor.view.updateState(state);
		}

		
		const viewState = editor.view.state.doc;
		const measurer = new TextMeasurer();
	
		viewState.descendants((node, pos) => {
			if (node.type.name === Paragraph.name) {
				const $pos = viewState.resolve(pos);
				const body = $pos.parent;
				if (body.lastChild !== node) return false;

				const paragraph = editor.view.nodeDOM(pos) as HTMLElement;
				const dummy = document.createElement("span");
				paragraph.appendChild(dummy);
				let lastLineWidth = dummy.offsetLeft - bodyElement.offsetLeft;
				dummy.remove();

				const end = $pos.end();
				let lastLinePos = end;

				let width = 0;
				let prevWidth = null;

				while (lastLineWidth > width && width !== prevWidth) {
					lastLinePos -= 1;
					const text = viewState.textBetween(lastLinePos - 1, end);
					const metrics = measurer.paragraph(text);

					prevWidth = width;
					width = Math.round(metrics.width);

					if (lastLinePos < pos) {
						throw new Error("infinite loop while determining last line");
					}
				}

				this.storage.pagesLastLinePositions.set(node.attrs.id, lastLinePos);

				return false;
			}
		});
	
		this.storage.previousState = editor.state;
	}
});

const extensions = [
	Paging,
	UniqueID,
	Doc,
	Page,
	Body,
	Paragraph,
	Heading.configure({
		levels: [1, 2],
	}),
	Text,
	TextAlign.configure({
		types: ['heading', 'paragraph'],
	}),
];

function EditorToolbar() {
	const { editor } = useCurrentEditor();

	if (!editor) {
		return null;
	}

	return (
		<Space className="editor-options">
			<ButtonGroup>
				<Button
					onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
					disabled={!editor.can().toggleHeading({ level: 1 })}
					type={editor.isActive('heading', { level: 1 }) ? 'primary' : 'default'}
				>
					H1
				</Button>
				<Button
					onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
					disabled={!editor.can().toggleHeading({ level: 2 })}
					type={editor.isActive('heading', { level: 2 }) ? 'primary' : 'default'}
				>
					H2
				</Button>
			</ButtonGroup>
			<ButtonGroup>
				<Button 
					onClick={() => editor.chain().focus().setTextAlign('left').run()}
					disabled={!editor.can().setTextAlign('left')}
					type={editor.isActive({ textAlign: 'left' }) ? 'primary' : 'default'}
				>
					Normal
				</Button>
				<Button 
					onClick={() => editor.chain().focus().setTextAlign('center').run()}
					disabled={!editor.can().setTextAlign('center')}
					type={editor.isActive({ textAlign: 'center' }) ? 'primary' : 'default'}
				>
					Centralizar
				</Button>
				<Button 
					onClick={() => editor.chain().focus().setTextAlign('justify').run()}
					disabled={!editor.can().setTextAlign('justify')}
					type={editor.isActive({ textAlign: 'justify' }) ? 'primary' : 'default'}
				>
					Justificar	
				</Button>
			</ButtonGroup>
		</Space>
	);
}

function MyEditor() {
	return (
		<EditorProvider 
			slotBefore={<EditorToolbar />}
			extensions={extensions} 
			autofocus={true} 
			editable={true}
			content="<p>Hello World</p>">
			<></>
		</EditorProvider>
	);
}

export function App() {
	return <main><MyEditor /></main>;
}
