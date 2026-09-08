import { createRoot } from 'react-dom/client';
import Game from './components/game';
import './app/globals.css';
import './app/game.css';
createRoot(document.getElementById('root')!).render(<Game/>);
