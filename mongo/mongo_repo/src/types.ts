import {Document, WithId} from "mongodb";

export type Payload = {
    id: string;
}

export type Schema = WithId<Document> & {
    id: string;
    payload: Payload
}

export type QueryArgs = {
    req: Request;
}