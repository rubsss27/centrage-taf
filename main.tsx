import React from 'react';
import {createRoot} from 'react-dom/client';
import FlightApp from './components/FlightApp';
import './app/design.css';
createRoot(document.getElementById('root')!).render(<FlightApp/>);
