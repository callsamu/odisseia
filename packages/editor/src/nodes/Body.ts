import { Node, mergeAttributes } from '@tiptap/core';
import { PageBodyStyles, PageStyles } from '../norms/styles';
import { Attrs } from '@tiptap/pm/model';
import { bodyHeightInCm, bodyWidthInCm, clear } from '../norms/utils';
import { DefaultNorm } from '../norms/DefaultNorm';
import { Norm } from '../norms/Norm';

interface BodyOptions {
	norm: Norm,
	HTMLAttributes: Object,
}

interface BodyStyleAttr extends PageStyles, PageBodyStyles {}

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

	addAttributes() {
		return {
			style: {
				default: buildBodyStyle(this.options.norm),
				parseHTML: () => buildBodyStyle(this.options.norm),
				renderHTML: (attrs: Attrs) => {
					const style: BodyStyleAttr = attrs.style;

					const styleString = clear(`
						margin-left: ${style.marginLeft}cm
						margin-right: ${style.marginRight}cm
						margin-top: ${style.marginTop}cm
						margin-bottom: ${style.marginBottom}cm
						width: ${style.width}cm
						height: ${style.height}cm
					`);

					return { style: styleString };
				}
			},
		}
	},

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
