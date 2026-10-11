import './styles.css';
import { installAnalytics } from './analytics';
import { App } from './ui/app';
import { installScrollGuard } from './ui/scroll-guard';
import { installBlocklyDialogs } from './blocks/var-types';

installAnalytics();
installScrollGuard();
installBlocklyDialogs();
const app = new App();
app.init().catch((err) => {
  console.error(err);
  document.body.prepend(Object.assign(document.createElement('p'), { className: 'fatal', textContent: String(err) }));
});
