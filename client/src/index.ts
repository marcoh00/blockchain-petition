import { KeyGenerator, MetaMaskConnector } from './testWidgets';

const IDP_ENDPOINT = "http://localhost:65535";
const REGISTRY_CONTRACT = "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0";

customElements.define("key-generator", KeyGenerator);
customElements.define("metamask-connector", MetaMaskConnector);