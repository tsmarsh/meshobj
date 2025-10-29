# Merminator Mermaid classDiagram Prompt Guide

Merminator is a parser and config generator for a **subset** of Mermaid's `classDiagram` syntax. Use the following rules and examples to construct diagrams that are compatible and functional.

## ✅ Supported Features

### 1. Class Declarations

```mermaid
class Farm {
  id: ID!
  name: String!
}
```

Use `class ClassName {}` to define a class. Each class represents an object in your domain model.

### 2. Attributes (Fields)

```mermaid
class Hen {
  id: ID!
  name: String
  dob: Date
  coop_id: ID!
}
```

* Format: `fieldName: Type`
* Use GraphQL-compatible types (String, Int, Boolean, ID, Date)
* Add `!` to indicate required fields

### 3. Methods (GraphQL Queries)

```mermaid
class Coop {
  getByFarm(farm_id: ID!): [Coop]
}
```

* Syntax: `methodName(param: Type): ReturnType`
* Can return scalars or `[ClassName]` lists
* All queries get an implicit `at: Float` param for temporal queries

### 4. Composition / Association Relations

```mermaid
Farm *-- Coop
Coop *-- Hen
```

* Use `*--` to declare that one class depends on another
* Merminator will:

  * Add reverse fields (e.g. `coops: [Coop]` in `Farm`)
  * Expect corresponding query (e.g. `getByFarm` in `Coop`)

## ⚠️ Required Conventions

* Every `*--` relation must be backed by a `getByX` method in the dependent class.
* Relationship field names are inferred using the singular class name (pluralized automatically for reverse lookups).
* Foreign key fields (e.g. `coop_id: ID`) should exist in the dependent class.

## ❌ Unsupported Features

| Feature                  | Status    |           |
| ------------------------ | --------- | --------- |
| Inheritance \`<          | --\`      | ❌ Ignored |
| Access modifiers `+ - #` | ❌ Ignored |           |
| Abstract/static classes  | ❌ Ignored |           |
| Labels on relations      | ❌ Ignored |           |
| Other relation types     | ❌ Ignored |           |

## ✅ Valid Prompt Example

```mermaid
class Farm {
  id: ID!
  name: String!
}

class Coop {
  id: ID!
  name: String!
  farm_id: ID!
  getByFarm(farm_id: ID!): [Coop]
}

class Hen {
  id: ID!
  name: String
  coop_id: ID!
  getByCoop(coop_id: ID!): [Hen]
}

Farm *-- Coop
Coop *-- Hen
```

Use this example as a boilerplate when prompting an LLM to generate compatible Mermaid class diagrams for Merminator.

---

For more detail, see: [https://github.com/tsmarsh/meshobj/tree/main/packages/merminator](https://github.com/tsmarsh/meshobj/tree/main/packages/merminator)
