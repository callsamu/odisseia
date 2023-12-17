import { Node, mergeAttributes } from '@tiptap/core';
import { bodyHeightInCm, bodyWidthInCm, clear } from '../norms/utils';
import { DefaultNorm } from '../norms/DefaultNorm';
import { Norm } from '../norms/Norm';

interface BodyOptions {
	norm: Norm,
	HTMLAttributes: Object,
}

function buildBodyStyle(norm: Norm) {
	return {
		marginLeft: norm.pageBody.marginLeft,
		marginRight: norm.pageBody.marginRight,
		marginTop: norm.pageBody.marginTop,
		marginBottom: norm.pageBody.marginBottom,
		width: bodyWidthInCm(norm.page, norm.pageBody),
		height: bodyHeightInCm(norm.page, norm.pageBody),
	}
}

export const Body = Node.create<BodyOptions>({
  name: 'body',

  priority: 1000,

  addOptions() {
    return {
      HTMLAttributes: {
				class: 'page-body',
			},
			norm: DefaultNorm,
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
		const body = buildBodyStyle(this.options.norm);

		const style = { style: clear(`
			margin-left: ${body.marginLeft}cm
			margin-right: ${body.marginRight}cm
			margin-top: ${body.marginTop}cm
			margin-bottom: ${body.marginBottom}cm
			width: ${body.width}cm
			height: ${body.height}cm
			overflow-y: hidden
		`)};

		const HTMLAttrs = this.options.HTMLAttributes;
		const attrs = mergeAttributes(style, HTMLAttrs, HTMLAttributes);

    return ['div', attrs, 0]  
	},
});
