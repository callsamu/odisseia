import { mergeAttributes, Node } from '@tiptap/core'
import { Norm } from '../norms/Norm'
import { DefaultNorm } from '../norms/DefaultNorm'
import { textCSS } from '../norms/utils'

export interface CitationOptions {
	norm: Norm
  HTMLAttributes: Record<string, any>,
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    Citation: {
      /**
       * Set a title node
       */
      setCitation: () => ReturnType,
      /**
       * Toggle a title node
       */
      toggleCitation: () => ReturnType,
    }
  }
}

export const Citation = Node.create<CitationOptions>({
  name: 'citation',

  addOptions() {
    return {
			norm: DefaultNorm,
      HTMLAttributes: {
				class: "citation",
			},
    }
  },

  content: 'inline*',

  group: 'block',

  defining: true,

  parseHTML() {
    return [{
			tag: 'p',
			attrs: {
				class: "citation",
			}
		}]
  },

  renderHTML({ HTMLAttributes }) {
		const { citation } = this.options.norm;

		const style = { style: textCSS(citation) };

		const HTMLAttrs = this.options.HTMLAttributes;
		const attrs = mergeAttributes(style, HTMLAttrs, HTMLAttributes);

    return ['p', attrs, 0]
  },

  addCommands() {
    return {
      setCitation: () => ({ commands }) => {
        return commands.setNode(this.name)
      },
      toggleCitation: () => ({ commands }) => {
        return commands.toggleNode(this.name, 'paragraph')
      },
    }
  },
})
