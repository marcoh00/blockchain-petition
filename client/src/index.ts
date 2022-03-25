import { LoadData } from './loading';
import { ZokratesTester } from './zokrates';
import { ErrorView, MainPage, PetitionApp } from './layoutWidgets';
import { ConnectionPage, LandingPage, RegistryChooser, IdentityPage } from './setup';
import { IDPWidget, InformationalInfobar, NavigationBar, PeriodWidget } from './nav';
import { Petition } from './petition';

const IDP_ENDPOINT = "http://localhost:65535";
const REGISTRY_CONTRACT = "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0";

customElements.define("zokrates-tester", ZokratesTester);
customElements.define("load-data", LoadData);
customElements.define("petition-app", PetitionApp);
customElements.define("landing-page", LandingPage);
customElements.define("informational-infobar", InformationalInfobar);
customElements.define("navigation-bar", NavigationBar);
customElements.define("connection-page", ConnectionPage);
customElements.define("registry-chooser", RegistryChooser);
customElements.define("error-view", ErrorView);
customElements.define("identity-page", IdentityPage);
customElements.define("main-page", MainPage);
customElements.define("petition-card", Petition);
customElements.define("period-widget", PeriodWidget);
customElements.define("idp-widget", IDPWidget);