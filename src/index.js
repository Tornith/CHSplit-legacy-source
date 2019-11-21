import React from 'react';
import ReactDOM from 'react-dom';
import "./css/font-faces.css";
import "./css/default.css";
import * as serviceWorker from './serviceWorker';
import App from "./App";

ReactDOM.render(<App />, document.getElementById('root'));
serviceWorker.unregister();