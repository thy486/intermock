import { Address } from "./export";
import * as P from './namespaceExport';

interface User {
    id: string;
    createTime: number;
    address: Address;
    ability: P.Ability
}