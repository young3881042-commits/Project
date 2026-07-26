import AiAssistantPage from './AiAssistantPage.jsx';

export default function AppEditorPage({ navigate, onCreateSchedule }) {
  return <AiAssistantPage navigate={navigate} experience="app-edit" onCreateSchedule={onCreateSchedule} />;
}
