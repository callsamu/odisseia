import { Button, Space } from 'antd';
import ButtonGroup from 'antd/es/button/button-group';

import { Paging } from 'odisseia-editor';
import { EditorProvider, useCurrentEditor } from '@tiptap/react';

import './index.css';

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
					onClick={() => editor.chain().focus().unsetTextAlign().run()}
					disabled={!editor.can().unsetTextAlign()}
					type={editor.isActive({ textAlign: 'justify' }) ? 'primary' : 'default'}
				>
					Normal
				</Button>
				<Button 
					onClick={() => editor.chain().focus().setTextAlign('center').run()}
					disabled={!editor.can().setTextAlign('center')}
					type={editor.isActive({ textAlign: 'center' }) ? 'primary' : 'default'}
				>
					Centralizado
				</Button>
			</ButtonGroup>
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
