import { describe, it, expect } from "vitest";
import { callSubgraph } from "@meshql/graphlette";

describe("The Farm", () => {
    it("should build a server with multiple nodes", async () => {
        const query = `{
      getById(id: "${globalThis.farm_id}") {
        name 
        coops {
          name
          hens {
            eggs
            name
          }
        }
      }
    }`;

        const json = await callSubgraph(
            new URL(`http://localhost:${globalThis.__CONFIG__.port}/farm/graph`),
            query,
            "getById",
            `Bearer ${globalThis.__TOKEN__}`
        );

        expect(json.name).toBe("Emerdale");
        expect(json.coops.length).toBe(3);
    });

    it("should answer simple queries", async () => {
        const query = `{
      getByName(name: "duck") {
        id
        name
      }
    }`;

        const json = await callSubgraph(
            new URL(`http://localhost:${globalThis.__CONFIG__.port}/hen/graph`),
            query,
            "getByName",
            `Bearer ${globalThis.__TOKEN__}`
        );

        expect(json[0].id).toBe(globalThis.hen_ids["duck"]);
        expect(json[0].name).toBe("duck");
    });

    // it("should query in both directions", async () => {
    //     const query = `{
    //   getByCoop(id: "${globalThis.coop1_id}") {
    //     name
    //     eggs
    //     coop {
    //       name
    //       farm {
    //         name
    //       }
    //     }
    //   }
    // }`;
    //
    //     const json = await callSubgraph(
    //         new URL(`http://localhost:${globalThis.__CONFIG__.port}/hen/graph`),
    //         query,
    //         "getByCoop",
    //         `Bearer ${globalThis.__TOKEN__}`
    //     );
    //
    //     expect(json.length).toBe(2);
    //     expect(json.map((res: any) => res.name)).toEqual(
    //         expect.arrayContaining(["chuck", "duck"])
    //     );
    //     expect(json[0].coop.name).toBe("purple");
    // });

    it("should get latest by default", async () => {
        const query = `{
      getById(id: "${globalThis.coop1_id}") {
        id
        name
      }
    }`;

        const json = await callSubgraph(
            new URL(`http://localhost:${globalThis.__CONFIG__.port}/coop/graph`),
            query,
            "getById",
            `Bearer ${globalThis.__TOKEN__}`
        );

        expect(json.id).toBe(globalThis.coop1_id);
        expect(json.name).toBe("purple");
    });

    it("should get closest to the timestamp when specified", async () => {
        const query = `{
      getById(id: "${globalThis.coop1_id}", at: ${globalThis.first_stamp}) {
        name
      }
    }`;

        const json = await callSubgraph(
            new URL(`http://localhost:${globalThis.__CONFIG__.port}/coop/graph`),
            query,
            "getById",
            `Bearer ${globalThis.__TOKEN__}`
        );

        expect(json.name).toBe("red");
    });

    it("should obey the timestamps", async () => {
        const query = `{
      getById(id: "${globalThis.farm_id}", at: ${globalThis.first_stamp}) {
        coops {
          name
        }
      }
    }`;

        const json = await callSubgraph(
            new URL(`http://localhost:${globalThis.__CONFIG__.port}/farm/graph`),
            query,
            "getById",
            `Bearer ${globalThis.__TOKEN__}`
        );

        const names = json.coops.map((c: any) => c.name);
        expect(names).not.toContain("purple");
    });

    it("should pass timestamps to next layer", async () => {
        const query = `{
      getById(id: "${globalThis.farm_id}", at: ${Date.now()}) {
        coops {
          name
        }
      }
    }`;

        const json = await callSubgraph(
            new URL(`http://localhost:${globalThis.__CONFIG__.port}/farm/graph`),
            query,
            "getById",
            `Bearer ${globalThis.__TOKEN__}`
        );

        const names = json.coops.map((c: any) => c.name);
        expect(names).toContain("purple");
    });
});

// Helper functions
