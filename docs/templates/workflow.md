# <Workflow>

The trigger, the path and the end state, in one or two sentences of business language.

## Sequence Diagram

```mermaid
sequenceDiagram
    autonumber
    actor Actor as <persona>
    participant A as <entry point>
    participant B as <Action or Job (queue)>
    participant DB as <store>

    Actor->>A: <request>
    A->>B: <dispatch>
    B->>DB: <write>
```

## Detailed Pipeline

1. **<Stage>**:
   - [`<Class>`](../../<path to the source file>) <what it does, and on which queue>.
2. **<Stage>**:
   - [`<Class>`](../../<path to the source file>) <what it does>.
