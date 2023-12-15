import { Node, mergeAttributes } from '@tiptap/core';
import { clear } from '../norms/utils';
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
		const { page } = this.options.norm;

		const style = { style: clear(`
			width: ${page.width}cm
			height: ${page.height}cm
		`)};

		const HTMLAttrs = this.options.HTMLAttributes;
		const attrs = mergeAttributes(style, HTMLAttrs, HTMLAttributes);

    return ['div', attrs, 0]
  },
});


