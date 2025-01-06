import { Envelope } from "@meshql/common";
import {Document, WithId} from "mongodb";

export type Payload = {
    id: string;
}

export type Schema = WithId<Document> & Envelope<string>

export type QueryArgs = {
    req: Request;
}