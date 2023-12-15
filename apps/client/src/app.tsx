import { Button, Space } from 'antd';
import ButtonGroup from 'antd/es/button/button-group';

import { PaginatorExtension } from 'odisseia-editor';
import { EditorProvider, useCurrentEditor } from '@tiptap/react';

import './index.css';
import { ABNT } from 'odisseia-editor/src/norms/ABNT';

function EditorToolbar() {
	const { editor } = useCurrentEditor();

	if (!editor) {
		return null;
	}

	return (
		<Space className="editor-options">
			<ButtonGroup>
				<Button 
					onClick={() => editor.chain().focus().toggleBold().run()}
					disabled={!editor.can().toggleBold()}
					type={editor.isActive("bold") ? 'primary' : 'default'}
				>
					Negrito
				</Button>
			</ButtonGroup>
		</Space>
	);
}

function MyEditor() {
	const content: string = '<p>Começo de um Trabalho...</p>';

	let scale = 1.0;

	const paginator = PaginatorExtension.configure({ 
		norm: ABNT(scale),
	});

	return (
		<EditorProvider 
			slotBefore={<EditorToolbar />}
			extensions={[paginator]} 
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
