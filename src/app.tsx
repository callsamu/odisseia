import { Node } from '@tiptap/core';
import { mergeAttributes } from '@tiptap/core';
import { Text } from '@tiptap/extension-text';
import { EditorProvider, Extension, useCurrentEditor } from '@tiptap/react';
import './index.css';
import { findParentDomRefOfType, findParentNodeOfType } from 'prosemirror-utils';
import { Attrs, DOMSerializer, Fragment, ResolvedPos, Schema } from '@tiptap/pm/model';
import { EditorState, TextSelection, Transaction } from '@tiptap/pm/state';
import { Node as NodePM } from '@tiptap/pm/model'
import { TextAlign } from '@tiptap/extension-text-align';
import { Paragraph } from '@tiptap/extension-paragraph';
import { Heading, Level } from '@tiptap/extension-heading';
import { Bold } from '@tiptap/extension-bold';
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

function getCSS(element: Element, prop: string): string {
	return getComputedStyle(element).getPropertyValue(prop);
}

function fromPX(px: string): number {
	return Number(px.replace("px", ""));
}

class TextMeasurer {
	canvas: HTMLCanvasElement;
	ctx: CanvasRenderingContext2D;

	constructor() {
		this.canvas = document.createElement('canvas');
		this.ctx = this.canvas.getContext('2d')!;
	}

	setFont(font: string) {
		this.ctx.font = font;
	}

	metrics(text: string): TextMetrics {
		return this.ctx.measureText(text);
	}
}

interface LineData {
	position: number;
	size: number;
}

class LineBreaker {
	constructor(
		private measurer: TextMeasurer,
		private bounds: DOMRect,
	) {}

	lines(node: NodePM, style: ContentStyle): LineData[] {
		const text = node.textContent;
		if (text.length === 0) return [{
			size: 0,
			position: 0,
		}];

		let cursor = 0;
		let prevLine = 0;
		let lineWidth = 0;
		const lines: LineData[] = [];

		const font = `${style.weight} ${style.fontSize} ${style.fontFamily}`;
		this.measurer.setFont(font);

		const blank = this.measurer.metrics(" ");

		for (let i = 0; i < text.length; i++) {
			const char = text[i];
			if (char === " " || i === text.length - 1) {
				const word = text.slice(cursor, i + 1);

				let width!: number;
				if (word === " ") {
					width = blank.width;
				} else {
					const metrics = this.measurer.metrics(word);
					width = metrics.width;
				}
				
				if (lineWidth + width > this.bounds.width) {
					lines.push({ 
						position: prevLine, 
						size: cursor - prevLine 
					});
					lineWidth = width;
					prevLine = cursor;
				} else {
					lineWidth += width;
				}

				if (i === text.length - 1) {
					lines.push({ 
						position: prevLine, 
						size: i + 1 - prevLine 
					});
				}

				cursor = i + 1;
			}
		}

		return lines;
	}
}

class Paginator {
	constructor(
		private lb: LineBreaker,
		private schema: Schema,
		private bodyDimensions: DOMRect,
		private contentStyles: ContentStyles,
	) {}

	public joinDocument(tr: Transaction): Transaction {
		console.log("+++JOIN++++");
		while (tr.doc.childCount > 1) {
			if (tr.doc.firstChild) {
				tr = tr.join(tr.doc.firstChild.nodeSize, 2);
			}
		}

		const body = tr.doc.firstChild?.firstChild;
		if (!body) throw new Error('unable to get document body');

		let previousNode!: NodePM;
		let previousPos!: number;

		body.forEach((node, rpos) => {
			const pos = rpos + 1;

			if (previousNode?.attrs.broken) {
				const T1 = previousNode.firstChild;
				const T2 = node.firstChild;
				if (!T1 || !T2) throw new Error('Failed to join broken nodes: unable to get contents');
				
				const selection = tr.selection;

				const newContent = node.copy(Fragment.from([T1, T2]));
				tr = tr.replaceWith(previousPos, pos + node.nodeSize, newContent);

				if (selection.$head.parent === previousNode || selection.$head.parent === node) {
					const $head = selection.$head;
					let spos = previousPos + $head.parentOffset + 2;
					if (selection.$head.parent === node) {
						spos += previousNode.nodeSize - 2;
					}
					const $spos = tr.doc.resolve(spos);
					console.log(tr.doc.textBetween(previousPos, $spos.pos));
					const newSel = new TextSelection($spos, $spos);
					tr = tr.setSelection(newSel);
				}

				const resultant = tr.doc.nodeAt(previousPos + 1);
				if (!resultant) throw new Error('Failed to join broken nodes: unable to get resultant node');

				const style = retrieveStyleOf(resultant, this.contentStyles);
				const lines = this.lb.lines(resultant, style);
				tr = tr.setNodeAttribute(previousPos + 1, "lines", lines);
			}

			previousNode = node;
			previousPos = pos;
		});
		
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
		let newTr = tr;

		const contents: NodePM[] = [];
		let broken = false;

		let anchorSplitPart = 0;

		const parent = $pos.parent;
		if (parent.type.name === "body") {
			const content = tr.doc.nodeAt(pos);
			if (!content) throw new Error("content not found");
			contents.push(content);
		} else {
			broken = true;
			if (newTr.selection.$head.pos > pos) anchorSplitPart = 1;
			newTr = newTr.setNodeAttribute($pos.pos - $pos.parentOffset - 1, 'broken', true);
			const text = parent.textBetween($pos.parentOffset + 1, parent.nodeSize - 2);
			const fragment = Fragment.from(this.schema.text(text));
			contents.push(parent.copy(fragment));
		}

		let factor = broken ? 1 : 0;
		const body = $pos.node(depth - factor);
		body.forEach((node, nodePos) => {
			if (nodePos > pos) {
				contents.push(node);
			}
		});

		const newBody = body.copy(Fragment.fromArray(contents));
		const pageType  = this.schema.nodes['page'];
		const newPage = pageType.create(null, Fragment.from(newBody));

		const $anchor = newTr.selection.$anchor;

		const end = newTr.doc.nodeSize - 2;
		newTr = newTr.replaceWith(pos + factor, end, newPage) 

		factor = factor > 0 ? factor + 1 : 0;

		if (anchorSplitPart > 0) {
			const selNodePos = pos + factor + 4;
			let offset = $anchor.parentOffset - $pos.parentOffset;
			const $newAnchor = newTr.doc.resolve(selNodePos + offset);
			console.log("++++SPLIT++++");
			console.log(anchorSplitPart, $anchor.pos, pos);
			console.log(newTr.doc.nodeAt(selNodePos));
			console.log(newTr.doc.textBetween(selNodePos, selNodePos + offset));
			newTr = newTr.setSelection(new TextSelection($newAnchor, $newAnchor));
		} 

		console.log("BROKEN ANCHOR-SPLIT-PART", broken, anchorSplitPart);

		return newTr;
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
				const lineHeight = retrieveStyleOf(node, this.contentStyles).lineHeight;
				if (!lineHeight) throw new Error(`${type} line height not determined`);

				const lines: LineData[] = node.attrs.lines;
				const nodeHeight = lineHeight * lines.length;

				if (height + nodeHeight > this.bodyDimensions.height) {
					if (lines.length === 1) {
						split = doc.resolve(pos);
					} else {
						let prev!: LineData;
						for (let line of lines) {
							height += lineHeight;
							if (height > this.bodyDimensions.height) {
								split = doc.resolve(pos + prev.position);
								break;
							}
							prev = line;
						}
					}
					
				}

				height += nodeHeight;

				return false;
			}

			return true;
		});

		return split ? split : null;
	}
}

function isOverflown({ clientWidth, clientHeight, scrollWidth, scrollHeight }: HTMLElement) {
  return scrollHeight > clientHeight || scrollWidth > clientWidth;
} 

interface ContentStyle {
	fontFamily: string;
	fontSize: string;
	weight: string;

	lineHeight: number;
	ident: number;
}

type ContentStyles = Map<string, ContentStyle>;

function getSchemaNodeStyles(
	schema: Schema, 
	editor: Element, 
	type: string, 
	attrs: Attrs
): ContentStyle {
	const paragraph = Fragment.from(schema.nodes[type].create(attrs));
	const node = DOMSerializer.fromSchema(schema).serializeFragment(paragraph);

	editor.appendChild(node);
	const element = editor.lastElementChild;
	if (!element) throw new Error('Failed to get paragraph element');

	const styles: ContentStyle = {
		fontFamily: getCSS(element, 'font-family'),
		fontSize: getCSS(element, 'font-size'),
		weight: getCSS(element, 'font-weight'),
		lineHeight: fromPX(getCSS(element, 'line-height')),
		ident: fromPX(getCSS(element, 'text-indent')),
	}

	console.log(styles);
	
	element.remove();
	return styles;
}

function styleKeyOf(node: NodePM) {
	if (node.type.name === Heading.name) {
		return Heading.name + "-" + node.attrs.level;
	} else {
		return node.type.name;
	}
}

function retrieveStyleOf(node: NodePM, styles: ContentStyles): ContentStyle {
	const key = styleKeyOf(node);

	const style = styles.get(key);
	if (!style) throw new Error(`Node ${key} style not found`);

	return style;
}

interface PagingOptions {
	headings: number[];
}

interface PagingStorage {
	previousState: EditorState | null;
	contentStyles: Map<string, ContentStyle>;
};

const Paging: Extension = Extension.create<PagingOptions, PagingStorage>({
	name: 'paging',

	addOptions() {
		return {
			headings: [2],
		};
	},

	addExtensions() {
		const { headings } = this.options;
		return [
			Doc,
			Page,
			Body,
			Paragraph,
			Heading.configure({ 
				levels: headings as Level[],
			}),
			Text,
			TextAlign.configure({
				defaultAlignment: 'justify',
				types: ['heading', 'paragraph'],
			}),
			Bold,
		];
	},

	addStorage() {
		return {
			previousState: null,
			contentStyles: new Map(),
		}
	},

	addGlobalAttributes() {
		return [{
			types: CONTENT_NODES,
			attributes: {
				broken: {
					default: null,
					parseHTML: (element: Element) => element.getAttribute('broken'),
					renderHTML: (attributes: any) => ({ broken: attributes.broken }),
				},
				lines: {
					default: [{ 
						size: 0,
						position: 0
					}],
					parseHTML: (_: Element) => [],
					renderHTML: (_: any) => ({}),
				},
			},
		}];
	},

	// @ts-ignore
	onCreate() {
		const { editor, storage } = this;
		const parent = document.querySelector(".tiptap");
		if (!parent) throw new Error('Failed to get editor element');

		for (const type of CONTENT_NODES) {
			if (type === Heading.name) {
				for (const level of this.options.headings) {
					const attrs = { level };
					const styles = getSchemaNodeStyles(editor.schema, parent, type, attrs);
					const key = type + "-" + level;
					storage.contentStyles.set(key, styles);
					console.log(key, styles);
				}
			} else {
				const attrs = {};
				const styles = getSchemaNodeStyles(editor.schema, parent, type, attrs);
				const key = type;
				storage.contentStyles.set(key, styles);
				console.log(key, styles);
			}
		}

		const bodyElement = parent.querySelector(".page-body");
		if (!bodyElement) throw new Error('Failed to get body element');

		const dimensions = bodyElement.getBoundingClientRect();
		const measurer = new TextMeasurer();
		const lb = new LineBreaker(measurer, dimensions);

		let newTr = editor.state.tr;

		editor.state.doc.descendants((node, pos) => {
			if (CONTENT_NODES.includes(node.type.name)) {
				const style = retrieveStyleOf(node, storage.contentStyles);
				const lines = lb.lines(node, style);
				newTr = newTr.setNodeAttribute(pos, "lines", lines);
			}
		});

		const newState = editor.state.apply(newTr);
		editor.view.updateState(newState);
	},

  onUpdate(): void {
		const { editor, storage } = this;
		const { schema, selection, doc } = editor.state;
		let newTr = editor.state.tr;

		let inserting = false;
		let deleting = false;

		const { 
			previousState: prev, 
			contentStyles: styles,
		} = storage;

		if (prev) {
			if (selection.$anchor.node(2) && prev.selection.$anchor.node(2))
				deleting = newTr.doc.nodeSize < prev.doc.nodeSize;
		}

		const { $anchor } = selection;
		const content = $anchor.parent;
		const $contentPos = doc.resolve($anchor.pos - $anchor.parentOffset - 1);

		const domAtPos = editor.view.domAtPos.bind(editor.view);
		const { node: body } = findParentNodeOfType(schema.nodes['body'])(selection) ?? {};
		if (!body) throw new Error('Failed to get body element');

		const bodyDOM = findParentDomRefOfType(schema.nodes['body'], domAtPos)(selection);
		const bodyElement = bodyDOM as HTMLElement;
		const rect = bodyElement.getBoundingClientRect();
		inserting = isOverflown(bodyElement);

		const measurer = new TextMeasurer();
		const lb = new LineBreaker(measurer, rect);
		const lines = lb.lines(content, retrieveStyleOf(content, styles));
		console.log(lines);
		const prevLines: LineData[] = content.attrs.lines;
		newTr.setNodeAttribute($contentPos.pos, 'lines', lines);

		inserting = inserting || 
			prevLines.length > lines.length && 
			body.lastChild === content &&
			content.attrs.broken;

		if (inserting || deleting) {
			const paginator = new Paginator(
				lb,
				editor.state.schema,
				rect,
				styles
			);

			newTr = paginator.joinDocument(newTr);
			newTr = paginator.splitDocument(newTr);
			newTr = newTr.scrollIntoView();
		}

		storage.previousState = editor.state;
		const newState = editor.state.apply(newTr);
		editor.view.updateState(newState);
	}
});

function EditorToolbar() {
	const { editor } = useCurrentEditor();

	if (!editor) {
		return null;
	}

	return (
		<Space className="editor-options">
			<ButtonGroup>
				<Button
					onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
					disabled={!editor.can().toggleHeading({ level: 2 })}
					type={editor.isActive('heading', { level: 2 }) ? 'primary' : 'default'}
				>
					Título
				</Button>
			</ButtonGroup>
			<ButtonGroup>
				<Button 
					onClick={() => editor.chain().focus().setTextAlign('center').run()}
					disabled={!editor.can().setTextAlign('center')}
					type={editor.isActive({ textAlign: 'center' }) ? 'primary' : 'default'}
				>
					Centralizar
				</Button>
			</ButtonGroup>
			<ButtonGroup>
				<Button 
					onClick={() => editor.chain().focus().toggleBold().run()}
					disabled={!editor.can().toggleBold()}
					type={editor.isActive("bold") ? 'primary' : 'default'}
				>
					Bold	
				</Button>
			</ButtonGroup>
		</Space>
	);
}

function MyEditor() {
	const content: string = '<p>Começo de um Trabalho...</p>';

	return (
		<EditorProvider 
			slotBefore={<EditorToolbar />}
			extensions={[Paging]} 
			autofocus={true} 
			editable={true}
			content={content}>
			<></>
		</EditorProvider>
	);
}

export function App() {
	return <main><MyEditor /></main>;
}
