import { mergeAttributes, Node } from '@tiptap/core'
import { Norm } from '../norms/Norm'
import { DefaultNorm } from '../norms/DefaultNorm'
import { textCSS } from '../norms/utils'

export interface TitleOptions {
	norm: Norm
  HTMLAttributes: Record<string, any>,
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    Title: {
      /**
       * Set a title node
       */
      setTitle: () => ReturnType,
      /**
       * Toggle a title node
       */
      toggleTitle: () => ReturnType,
    }
  }
}

export const Title = Node.create<TitleOptions>({
  name: 'title',

  addOptions() {
    return {
			norm: DefaultNorm,
      HTMLAttributes: {},
    }
  },

  content: 'inline*',

  group: 'block',

  defining: true,

  parseHTML() {
    return [{
			tag: 'h1',
		}]
  },

  renderHTML({ HTMLAttributes }) {
		const { title } = this.options.norm;

		const style = { style: textCSS(title) };

		const HTMLAttrs = this.options.HTMLAttributes;
		const attrs = mergeAttributes(style, HTMLAttrs, HTMLAttributes);

    return ['h1', attrs, 0]
  },

  addCommands() {
    return {
      setTitle: () => ({ commands }) => {
        return commands.setNode(this.name)
      },
      toggleTitle: () => ({ commands }) => {
        return commands.toggleNode(this.name, 'paragraph')
      },
    }
  },
})
