import { useState } from 'react';
import FreePlay from './FreePlay';
import Levels from './Levels';

type Tab = 'levels' | 'free';
const TAB_KEY = 'numerical-links:tab';

function loadTab(): Tab {
  try {
    return localStorage.getItem(TAB_KEY) === 'free' ? 'free' : 'levels';
  } catch {
    return 'levels';
  }
}

export default function App() {
  const [tab, setTab] = useState<Tab>(loadTab);

  const pick = (t: Tab) => {
    setTab(t);
    try {
      localStorage.setItem(TAB_KEY, t);
    } catch {
      // Not remembered; fine.
    }
  };

  return (
    <div className="app">
      <header className="header">
        <h1>Numerical Links</h1>
        <nav className="tabs">
          <button className={tab === 'levels' ? 'active' : ''} onClick={() => pick('levels')}>
            Levels
          </button>
          <button className={tab === 'free' ? 'active' : ''} onClick={() => pick('free')}>
            Free play
          </button>
        </nav>
      </header>
      {tab === 'levels' ? <Levels /> : <FreePlay />}
    </div>
  );
}
