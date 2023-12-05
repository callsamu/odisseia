import { Node } from '@tiptap/core';
import { mergeAttributes } from '@tiptap/core';
import { Text } from '@tiptap/extension-text';
import { EditorProvider, Extension, useCurrentEditor } from '@tiptap/react';
import './index.css';
import { Editor } from '@tiptap/core';
import { findParentDomRefOfType } from 'prosemirror-utils';
import { Fragment, ResolvedPos } from '@tiptap/pm/model';
import { EditorState, Plugin, Transaction } from '@tiptap/pm/state';
import { EditorView } from '@tiptap/pm/view';
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

class Paginator {
	bodyDimensions: DOMRect;

	constructor(
		public view: EditorView,
		public state: EditorState,
		body: HTMLElement,
	) {
		const rect = body.getBoundingClientRect();
		this.bodyDimensions = rect;
	}

	public joinDocument(tr: Transaction): Transaction {
		while (tr.doc.childCount > 1) {
			if (tr.doc.firstChild) tr.join(tr.doc.firstChild.nodeSize, 2);
		}
		return tr;
	}

	public splitDocument(tr: Transaction, split?: ResolvedPos): Transaction {
		if (!split) {
			const s = this.getSplitPos(tr.doc);
			if (!s) return tr;
			split = s;
		}

		let newTransaction = this.splitPage(tr, split);

		const after = this.getSplitPos(newTransaction.doc);
		if (after) {
			return this.splitDocument(newTransaction, after);
		}

		return newTransaction;
	}

	private splitPage(tr: Transaction, $pos: ResolvedPos): Transaction {
		const { pos, depth } = $pos;

		const paragraph = $pos.doc.nodeAt(pos);
		if (!paragraph) return tr;

		const bodyOfPage = $pos.node(depth);
		const contents: NodePM[] = [];
		bodyOfPage.forEach((node, nodePos) => {
			if (nodePos >= $pos.parentOffset) {
				contents.push(node);
			}
		});

		const body = $pos.node(depth).copy(Fragment.from(contents));
		const page = this.state.schema.nodes['page'].create(null, body);

		const end = $pos.doc.resolve(0).end();
		return tr.replaceWith(pos, end, page);
	}

	private getSplitPos(doc: NodePM): ResolvedPos | null {
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
	previousState: EditorState | null
}

const Paging: Extension = Extension.create<{}, PagingStorage>({
	name: 'paging',

	addStorage() {
		return {
			previousState: null,
		}
	},

	// @ts-ignore
  onUpdate({ editor }: { editor: Editor }): void {
		const { schema, selection, tr } = editor.state;

		const domAtPos = editor.view.domAtPos.bind(editor.view);
		const bodyDOM = findParentDomRefOfType(schema.nodes['body'], domAtPos)(selection);
		const bodyElement = bodyDOM as HTMLElement;

		let deleting = false;

		if (this.storage.previousState) {
			const prev = this.storage.previousState;
			if (selection.$anchor.node(2) && prev.selection.$anchor.node(2))
				deleting = tr.doc.nodeSize < prev.doc.nodeSize
		}

		console.log(this.storage);

		const inserting = isOverflown(bodyElement);

		if (inserting || deleting) {
			const paginator = new Paginator(editor.view, editor.state, bodyElement);
			let newTransaction = tr;
			newTransaction = paginator.joinDocument(newTransaction);
			newTransaction = paginator.splitDocument(newTransaction);
			newTransaction = newTransaction.scrollIntoView();
			const state = editor.state.apply(newTransaction);
			editor.view.updateState(state);
		}

		this.storage.previousState = editor.state;
	},
})

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
