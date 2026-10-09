import './styles.css';
import { App } from './ui/app';

const app = new App();
app.init().catch((err) => {
  console.error(err);
  document.body.prepend(Object.assign(document.createElement('p'), { className: 'fatal', textContent: String(err) }));
});
