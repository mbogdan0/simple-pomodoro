import { startApp } from './app/bootstrap.js';

const root = document.querySelector('#app');

if (!root) {
  throw new Error('Cannot find #app root.');
}

startApp(root);
