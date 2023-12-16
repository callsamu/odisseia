import { Show, createSignal, onCleanup, onMount } from 'solid-js';
import type { JSX } from 'solid-js';

import { Editor } from '@tiptap/core';
import { PaginatorExtension, ABNT } from 'odisseia-editor';

interface MarkButtonProps {
	name: string;
	editor: Editor;
	children: JSX.Element;
}

function MarkButton(props: MarkButtonProps) {
	const { name, editor, children } = props;
	const active = editor.isActive(name);

	return (
		<button 
			onClick={() => editor.chain().focus().toggleMark(name).run()}
			class={`flex items-center btn btn-sm ${active ? 'btn-primary' : 'btn-ghost'}`}>
			{children}
		</button>
	);
}

function App() {
	let container!: HTMLDivElement;

	let [editor, setEditor] = createSignal<Editor | null>(null, {
		equals: false,
	});

	onMount(() => {
		let scale!: number;
		const w = window.innerWidth;

		if (w < 768) {
			scale = 0.4;
		} else if (w < 1024) {
			scale = 0.7;
		} else {
			scale = 1.0;
		}

		const paginator = PaginatorExtension.configure({
			norm: ABNT(scale),
		});

		setEditor(new Editor({
			element: container,
			extensions: [paginator],
			content: '<p>Começo de um Trabalho...</p>',
			onTransaction: () => setEditor(editor()),
		}));
	});

	onCleanup(() => {
		editor()!.destroy();
		setEditor(null);
	});

  return (
		<main>
			<Show when={editor()}>
				<header class="flex z-10 top-0 border-b-2 border-b-primary sticky justify-center items-center bg-base-100 gap-2">
						<select 
							onChange={e => editor()!.chain().focus().setNode(e.target.value).run()}
							class="select select-ghost focus:border-none focus:outline-none"
						>
							<option value="paragraph" selected={editor()!.isActive('paragraph')}>
								Texto Normal
							</option>
							<option value="title" selected={editor()!.isActive('title')}>
								Título
							</option>
						</select>
						<MarkButton name="bold" editor={editor()!}>
							<b>B</b>
						</MarkButton>
						<MarkButton name="italic" editor={editor()!}>
							<i>I</i>
						</MarkButton>
				</header>
			</Show>
			<div ref={container}></div>
		</main>
  );
}

export default App
