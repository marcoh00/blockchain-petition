import { EthereumConnector, IPetition } from "../../shared/web3";
import { decorateClassWithState, IState } from "./state";

function idToNumber(id: number[] | Uint8Array): number {
    let result = 0;
    for(const byte of id) {
        if(byte > 0xff) throw new Error(`Invalid byte: ${byte}`)
        result = (result << 8) | byte;
    }
    console.log("idToNumber", id, result);
    return result;
}

interface ITimeSpan {
    start: Date
    end: Date
    isNow(): boolean
}

class TimeSpan implements ITimeSpan {
    start: Date
    end: Date

    constructor(start: Date, end: Date) {
        this.start = start;
        this.end = end;
    }

    isNow(): boolean {
        const now = Date.now();
        const after_start = this.start.getTime() <= now;
        const before_end = this.end.getTime() > now;
        console.log(`now: ${now} start: ${this.start.getTime()} end: ${this.end.getTime()} after: ${after_start} before: ${before_end} result: ${after_start && before_end}`);
        return after_start && before_end;
    }
}

interface IPeriodTimeSpan {
    [period: string]: ITimeSpan
}

interface IPetitionByPeriod {
    [period: string]: IPetition[]
}

interface IPetitionById {
    [id: string]: IPetition
}

class Web3RepositoryBase {}
export class Web3Repository extends decorateClassWithState(Web3RepositoryBase) {
    connector: EthereumConnector
    period: number
    period_time_cache: IPeriodTimeSpan
    petitions_by_period: IPetitionByPeriod
    petitions_by_id: IPetitionById
    initialized: boolean
    locked: boolean

    constructor(connector: EthereumConnector) {
        super();
        this.connector = connector;
        this.initialized = false;
        this.locked = false;
        this.period = -1;
        this.period_time_cache = {};
        this.petitions_by_period = {};
        this.petitions_by_id = {};
    }

    async init() {
        this.setState({
            ...this.getState(),
            lockspinner: true,
            locktext: "Lade Blockchain-Daten"
        });
        await this.setPeriod();
        await this.refresh();
        await this.startPeriodRefreshInterval();
        this.initialized = true;
        this.setState({
            ...this.getState(),
            lockspinner: false,
            locktext: undefined
        });
    }

    async refresh() {
        const byPeriod: IPetitionByPeriod = {};
        for(const petition of await this.connector.petitions()) {
            await this.addToTimeCacheIfNeccessary(petition.period);
            if(!byPeriod.hasOwnProperty(petition.period.toString())) byPeriod[petition.period.toString()] = [];
            byPeriod[petition.period.toString()].push(petition);
            this.petitions_by_id[idToNumber(petition.id).toString()] = petition;
        }
        this.petitions_by_period = byPeriod;
        console.log("Refresh", this.petitions_by_id, this.petitions_by_period)
    }

    async addToTimeCacheIfNeccessary(period: number) {
        if(!this.period_time_cache.hasOwnProperty(period)) {
            const start = new Date(await this.connector.startPeriod(period) * 1000);
            const end = new Date(await this.connector.startPeriod(period + 1) * 1000);
            this.period_time_cache[period] = new TimeSpan(start, end);
        }
    }

    async startPeriodRefreshInterval() {        
        await this.setPeriod();
        await this.addToTimeCacheIfNeccessary(this.period);

        const span = this.period_time_cache[this.period].end.getTime() - this.period_time_cache[this.period].start.getTime();
        const next_period_boundary_in_s = this.period_time_cache[this.period].end.getTime() - Date.now();
        
        const refresh = () => {
            console.log("Refresh period");
            this.setPeriod();
            setTimeout(refresh, span);
        }

        // On first calculated epoch boundary
        setTimeout(refresh, next_period_boundary_in_s * 1000);

        // 10 seconds after (clock skew)
        setTimeout(refresh, (next_period_boundary_in_s + 10) * 1000)

        // 10 seconds before (or now if there are less than 10s left)
        if(next_period_boundary_in_s > 10) {
            setTimeout(refresh, (next_period_boundary_in_s - 10) * 1000);
        } else {
            setTimeout(refresh, (next_period_boundary_in_s + span - 10) * 1000);
        }

        setInterval(() => this.setPeriod(), 30000);
    }

    async setPeriod() {
        const pre_period = this.period;
        this.period = await this.connector.period();
        console.log("Set period from/to", pre_period, this.period);
        this.addToTimeCacheIfNeccessary(this.period);
        if(pre_period !== this.period && !this.getState().customPeriod) this.notifyNewPeriod();
    }

    async stateChanged(state: IState): Promise<void> {
        console.trace();
        console.log("period/state period/truth", state.period, this.period);
    }

    notifyNewPeriod() {
        console.log("New period", this.period);
        this.setState({
            ...this.getState(),
            period: this.period
        });
    }
}

let localWeb3repository: Web3Repository = null;
export async function getWeb3Repository(connector: EthereumConnector) {
    if(localWeb3repository === null) localWeb3repository = new Web3Repository(connector);
    if(!localWeb3repository.initialized) await localWeb3repository.init();
    return localWeb3repository;
}