import { Node, mergeAttributes } from '@tiptap/core';
import { PageStyles } from '../norms/styles';
import { clear } from '../norms/utils';
import { Attrs } from '@tiptap/pm/model';
import { DefaultNorm } from '../norms/DefaultNorm';
import { Norm } from '../norms/Norm';

interface PageOptions {
	norm: Norm;
	HTMLAttributes: Record<string, any>;
}

export const Page = Node.create<PageOptions>({
  name: 'page',

  priority: 1000,

  addOptions() {
    return {
			norm: DefaultNorm,
      HTMLAttributes: {
				class: 'page',
			},
    }
  },

  group: 'page',
  content: 'body',

	addAttributes() {
		return {
			style: {
				default: this.options.norm.page,
				parseHTML: () => this.options.norm.page,
				renderHTML: (attrs: Attrs) => {
					const style: PageStyles = attrs.style;
					const styleString = clear(`
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
					class: "page",
				}
			},
    ]
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(this.options.HTMLAttributes, HTMLAttributes), 0]
  },
});


