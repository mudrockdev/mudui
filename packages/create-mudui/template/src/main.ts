import { render } from 'mudui';
import App from './App.svelte';

const app = render(App);
await app.waitUntilExit();
