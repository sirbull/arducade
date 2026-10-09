import './styles.css';
import { App } from './ui/app';

const app = new App();
// Handy when testing the editor from the browser console.
(window as unknown as { __abApp: App }).__abApp = app;
app.init().catch((err) => {
  console.error(err);
  document.body.prepend(Object.assign(document.createElement('p'), { className: 'fatal', textContent: String(err) }));
});
