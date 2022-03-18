import {
    CredentialRetriever,
    KeyGenerator,
    MetaMaskConnector,
    PetitionList,
} from './testWidgets';
import { LoadData } from './loading';
import { ZokratesTester } from './zokrates';
import { PetitionApp } from './layoutWidgets';
import { ConnectionPage, LandingPage, RegistryChooser } from './setup';
import { InformationalInfobar, NavigationBar } from './nav';

const IDP_ENDPOINT = "http://localhost:65535";
const REGISTRY_CONTRACT = "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0";

customElements.define("key-generator", KeyGenerator);
customElements.define("metamask-connector", MetaMaskConnector);
customElements.define("credential-retriever", CredentialRetriever);
customElements.define("zokrates-tester", ZokratesTester);
customElements.define("petition-list", PetitionList);
customElements.define("load-data", LoadData);
customElements.define("petition-app", PetitionApp);
customElements.define("landing-page", LandingPage);
customElements.define("informational-infobar", InformationalInfobar);
customElements.define("navigation-bar", NavigationBar);
customElements.define("connection-page", ConnectionPage);
customElements.define("registry-chooser", RegistryChooser);