import { Extension } from '@tiptap/core';
import { Document, Page, Body, Title, NormParagraph, textStyle } from './nodes/';

import { Node } from '@tiptap/pm/model'
import { Fragment, ResolvedPos, Schema } from '@tiptap/pm/model';
import { EditorState, Selection, TextSelection, Transaction } from '@tiptap/pm/state';

import { findParentDomRefOfType, findParentNodeOfType } from 'prosemirror-utils';

import { Text } from '@tiptap/extension-text';
import { Bold } from '@tiptap/extension-bold';

import { lineHeightInPx } from './norms/utils';
import { Norm } from './norms/Norm';
import { DefaultNorm } from './norms/DefaultNorm';
import { ABNT } from './norms/ABNT';
import Italic from '@tiptap/extension-italic';
import { LineCounter, LineData } from './layout/LineCounter';
import { TextMeasurer } from './layout/TextMeasurer';
import { Citation } from './nodes/Citation';

const TEXT_CONTENT_NODES = [Title.name, NormParagraph.name, Citation.name];

class Paginator {
	constructor(
		private norm: Norm,
		private lc: LineCounter,
		private schema: Schema,
		private bodyDimensions: DOMRect,
	) {}

	public joinDocument(tr: Transaction): Transaction {
		console.log("+++JOIN++++");
		while (tr.doc.childCount > 1) {
			if (tr.doc.firstChild) {
				tr = tr.join(tr.doc.firstChild.nodeSize, 2);
			}
		}

		console.log(tr.doc.firstChild?.firstChild?.toJSON());

		const body = tr.doc.firstChild?.firstChild;
		if (!body) throw new Error('unable to get document body');

		let previousNode!: Node;
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

				const lines = this.lc.lines(resultant);
				tr = tr.setNodeAttribute(previousPos + 1, "lines", lines);
			}

			previousNode = node;
			previousPos = pos;
		});
		
		return tr;
	}

	public splitDocument(tr: Transaction, split?: ResolvedPos): Transaction {
		console.log("++++SPLIT++++");
		if (!split) {
			const s = this.findSplitNodePos(tr.doc);
			if (!s) return tr;
			split = s;
		}
		console.log(split);

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

		const contents: Node[] = [];

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

			const parentPos = $pos.pos - $pos.parentOffset - 1;
			newTr = newTr.setNodeAttribute(parentPos, 'broken', true);

			const text = parent.textBetween($pos.parentOffset + 1, parent.nodeSize - 2);

			const lines: LineData[] = parent.attrs.lines;

			const breakIndex = lines.findIndex((l) => {
				return l.position === $pos.parentOffset + 1
			});
			if (breakIndex === -1) throw new Error("Failed to find break line index");

			const firstHalfLines = lines.slice(0, breakIndex);
			const secondHalfLines = lines.slice(breakIndex);

			newTr = newTr.setNodeAttribute(parentPos, 'lines', firstHalfLines);

			const type = this.schema.nodes[parent.type.name];
			const attrs = { lines: secondHalfLines };
			contents.push(type.create(attrs, Fragment.from(this.schema.text(text))));
		}

		let factor = broken ? 1 : 0;
		const body = $pos.node(depth - factor);

		let bodyPos = 1;
		newTr.doc.forEach(node => {
			if (node !== newTr.doc.lastChild) {
				bodyPos += node.nodeSize
			}
		});

		body.forEach((node, nodePos) => {
			if (bodyPos + nodePos > pos) {
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
			console.log(anchorSplitPart, $anchor.pos, pos);
			console.log(newTr.doc.nodeAt(selNodePos));
			console.log(newTr.doc.textBetween(selNodePos, selNodePos + offset));
			newTr = newTr.setSelection(new TextSelection($newAnchor, $newAnchor));
		} 

		return newTr;
	}

	private findSplitNodePos(doc: Node): ResolvedPos | null {
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

			if (TEXT_CONTENT_NODES.includes(type)) {
				if (height > this.bodyDimensions.height) {
					split = doc.resolve(pos);
					return false;
				}

				const style = textStyle(node, this.norm);
				if (!style) throw new Error(`${type} style not determined`);

				const lines: LineData[] = node.attrs.lines;
				const lheight = lineHeightInPx(style);
				console.log("LHEIGHT: ", lheight);

				const nodeHeight = lheight * lines.length;

				if (height + nodeHeight > this.bodyDimensions.height) {
					if (lines.length === 1) {
						split = doc.resolve(pos);
					} else {
						let prev!: LineData;
						for (let line of lines) {
							height += lheight;
							if (height > this.bodyDimensions.height) {
								split = doc.resolve(pos + prev.position);
								break;
							}
							prev = line;
						}
					}
					
				}

				height += nodeHeight + style.spacing * lheight;

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

function parentFromPos($pos: ResolvedPos): [Node, ResolvedPos] {
	return [
		$pos.parent,
		$pos.doc.resolve($pos.pos - $pos.parentOffset),
	]
}

interface PaginatorOptions {
	norm: Norm;
}

interface PaginatorStorage {
	measurer: TextMeasurer;
	dimensions: DOMRect | null;
	previousState: EditorState | null;
	previousSelection: Selection | null;
};

export const PaginatorExtension: Extension = Extension.create<PaginatorOptions, PaginatorStorage>({
	name: 'paging',

	addOptions() {
		return { norm: DefaultNorm };
	},

	addExtensions() {
		return [
			Document,
			Page.configure({ norm: this.options.norm }),
			Body.configure({ norm: this.options.norm }),
			Title.configure({ norm: this.options.norm }),
			NormParagraph.configure({ norm: this.options.norm }),
			Citation.configure({ norm: this.options.norm }),
			Text,
			Bold,
			Italic,
		];
	},

	addStorage() {
		return {
			dimensions: null,
			previousState: null,
			previousSelection: null,
			contentStyles: new Map(),
			measurer: new TextMeasurer(),
		}
	},

	addGlobalAttributes() {
		return [{
			types: TEXT_CONTENT_NODES,
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

		const bodyElement = parent.querySelector(".page-body");
		if (!bodyElement) throw new Error('Failed to get body element');

		const dimensions = bodyElement.getBoundingClientRect();
		storage.dimensions = dimensions;

		const lb = new LineCounter(
			this.options.norm, 
			storage.measurer, 
			dimensions
		);

		let newTr = editor.state.tr;

		editor.state.doc.descendants((node, pos) => {
			if (TEXT_CONTENT_NODES.includes(node.type.name)) {
				const lines = lb.lines(node);
				newTr = newTr.setNodeAttribute(pos, "lines", lines);
			}
		});
			
		storage.previousState = editor.state;
		const newState = editor.state.apply(newTr);
		editor.view.updateState(newState);
	},

	onTransaction({ transaction: tr }) {
		console.log("====TRANSACTION====");
		console.log("STEPS:", tr.steps);
		const { 
			measurer, 
			dimensions,
			previousState,
			previousSelection,
		} = this.storage;

		const { editor } = this;

		let newTr = editor.state.tr;

		if (
			dimensions &&
			tr.docChanged &&
			previousState &&
			previousSelection &&
			!editor.view.composing &&
			!tr.getMeta("paginating")  &&
			!tr.getMeta("counting-lines")
		) {
			newTr = newTr.setMeta("counting-lines", true);

			let $anchor!: ResolvedPos;
			if (tr.selection.$anchor.pos < previousSelection.$anchor.pos) {
				$anchor = tr.selection.$anchor;
			} else {
				$anchor = previousSelection.$anchor;
			}

			let $head!: ResolvedPos;
			if (tr.doc.nodeSize === previousState.doc.nodeSize) {
				$head = previousSelection.$head;
			} else {
				$head = tr.selection.$head;
			}

			const [, $anchorContentPos] = parentFromPos($anchor);
			const [, $headContentPos] = parentFromPos($head);

			const lb = new LineCounter(this.options.norm, measurer, dimensions);

			tr.doc.nodesBetween($anchorContentPos.pos, $headContentPos.pos, (node, pos) => {
				if (TEXT_CONTENT_NODES.includes(node.type.name)) {
					console.log(node.type.name, node.textContent);
					const lines = lb.lines(node);
					console.log(node.type.name, pos, node.textContent, lines);
					newTr = newTr.setNodeAttribute(pos, "lines", lines);
				}
			});

			this.editor.view.dispatch(newTr);
		}

		this.storage.previousSelection = tr.selection;
	},

  onUpdate(): void {
		console.log("=====UPDATE=====");
		const { editor, storage } = this;
		const { schema, selection } = editor.state;

		let newTr = editor.state.tr;
		console.log("COMPOSING", editor.view.composing);
		console.log("DOC SIZE:", editor.state.doc.nodeSize);

		let inserting = false;
		let deleting = false;

		const { 
			previousState: prev, 
		} = storage;

		const domAtPos = editor.view.domAtPos.bind(editor.view);
		const { node: body } = findParentNodeOfType(schema.nodes['body'])(selection) ?? {};
		if (!body) throw new Error('Failed to get body element');

		if (prev && prev.doc.nodeSize !== editor.state.doc.nodeSize) {
			if (selection.$anchor.node(2) && prev.selection.$anchor.node(2)) {
				deleting = newTr.doc.nodeSize < prev.doc.nodeSize;
			}

			const [anchorContent, $anchorContentPos] = parentFromPos(selection.$anchor);
			console.log("BROKEN?", anchorContent.attrs.broken);
			console.log("LAST CHILD?", anchorContent === body.lastChild);
			if (anchorContent.attrs.broken && anchorContent === body.lastChild) {
				const oldNode = prev.doc.nodeAt($anchorContentPos.pos - 1);
				console.log("OLD NODE:", oldNode);
				inserting = oldNode !== null && oldNode.eq(prev.selection.$anchor.parent);
				console.log("IS INSERTING?", inserting);
			}
		}

		const bodyDOM = findParentDomRefOfType(schema.nodes['body'], domAtPos)(selection);
		const bodyElement = bodyDOM as HTMLElement;
		const rect = bodyElement.getBoundingClientRect();
		storage.dimensions = rect;
		inserting = inserting || isOverflown(bodyElement);
		console.log("OVERFLOWING?", isOverflown(bodyElement));

		const lb = new LineCounter(this.options.norm, storage.measurer, rect);

		if (inserting || deleting) {
			console.log("REPAGINATING", inserting, deleting);
			const paginator = new Paginator(
				this.options.norm,
				lb,
				editor.state.schema,
				rect,
			);

			newTr = newTr.setMeta("paginating", true);
			newTr = paginator.joinDocument(newTr);
			newTr = paginator.splitDocument(newTr);
			newTr = newTr.scrollIntoView();

			storage.previousState = editor.state;
			editor.view.dispatch(newTr);
		}

		storage.previousState = editor.state;
	}
});

export { ABNT };
