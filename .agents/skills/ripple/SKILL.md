---
name: ripple
description: Ripple (.ripple) TypeScript-first reactive UI framework. Use when creating/editing .ripple files, working with track() state, @ read syntax, component definitions, scoped styles, effects, or control flow in Ripple templates. Triggers on .ripple files, track(), @variable, export component, ripple imports.
---

# Ripple Framework Skill

Use this skill when working with Ripple (.ripple) files - a TypeScript-first UI framework.

**Always check https://www.ripple-ts.com/llms.txt for the most up-to-date framework references.**

## Core Syntax Rules

### Text Must Be In Expressions

```javascript
// WRONG
<div>Hello World</div>

// CORRECT
<div>{"Hello World"}</div>
```

### Tracked State with `track()` and `@` Syntax

```javascript
import { track } from 'ripple';

export component Counter() {
  let count = track(0);

  // Read with @variable
  // Write with @variable = value
  <button onClick={() => @count++}>
    {"Count: "}{@count}
  </button>
}
```

### Effects

```javascript
import { effect } from 'ripple';

effect(() => {
  console.log('Value changed:', @someValue);
  return () => {
    // cleanup function
  };
});
```

### Component Definition

```javascript
export component MyComponent(prop1: string, prop2?: number) {
  // Component body
  <div>{prop1}</div>
}
```

### Props with Defaults

```javascript
export component Button(label: string, disabled: boolean = false) {
  <button disabled={disabled}>{label}</button>
}
```

### Children/Slots

```javascript
export component Card(children: Children) {
  <div class="card">
    {children}
  </div>
}

// Usage
<Card>
  <div>{"Content"}</div>
</Card>
```

## Control Flow

### Conditionals (if/else)

```javascript
if (condition) {
  <div>{'True branch'}</div>;
} else {
  <div>{'False branch'}</div>;
}
```

### Loops (for)

```javascript
for (const item of items) {
  <div key={item.id}>{item.name}</div>;
}
```

### Switch

```javascript
switch (status) {
  case 'loading':
    <Spinner />;
    break;
  case 'error':
    <Error />;
    break;
  default:
    <Content />;
}
```

## Dynamic Classes

Use object syntax for conditional classes:

```javascript
<div class={{
  'base-class': true,
  'active': @isActive,
  'disabled': @isDisabled,
  'hidden': !@isVisible
}}>
  {"Content"}
</div>
```

## Dynamic Styles

```javascript
<div style={{
  width: `${@width}px`,
  height: @height > 0 ? `${@height}px` : 'auto'
}}>
  {"Content"}
</div>
```

## Event Handlers

```javascript
<button onClick={() => handleClick()}>{"Click"}</button>
<input onInput={(e) => @value = e.target.value} />
<div onMouseEnter={handleEnter} onMouseLeave={handleLeave} />
```

## Refs

```javascript
let inputRef: HTMLInputElement;

effect(() => {
  inputRef?.focus();
});

<input ref={inputRef} />
```

## Scoped Styles

```javascript
export component Styled() {
  <div class="container">
    {"Styled content"}
  </div>

  <style>
    .container {
      padding: 1rem;
    }

    :global(body) {
      margin: 0;
    }
  </style>
}
```

## Important Patterns

### NO JSX-STYLE COMMENTS IN TEMPLATES

JSX-style comments `{/* comment */}` cause "Illegal invocation" runtime errors:

```javascript
// WRONG - causes runtime crash
<div>
  {/* This comment breaks the app */}
  <span>{"Content"}</span>
</div>

// CORRECT - use TypeScript comments outside JSX or no comments in templates
<div>
  <span>{"Content"}</span>
</div>

// Or use // comments in the script part only
export component Example() {
  // This is fine - outside template
  let value = track(0);

  <div>
    <span>{@value}</span>
  </div>
}
```

### Avoid DOM Structure Changes in Conditionals

When conditionals cause runtime errors, use CSS `hidden` class instead:

```javascript
// If this causes issues:
if (condition) {
  <ComponentA />
} else {
  <ComponentB />
}

// Use CSS visibility instead:
<div class={{ 'hidden': !condition }}>
  <ComponentA />
</div>
<div class={{ 'hidden': condition }}>
  <ComponentB />
</div>
```

### Templates Only Inside Components

Cannot create JSX/templates in regular functions:

```javascript
// WRONG
function createButton() {
  return <button>{"Click"}</button>;
}

// CORRECT - use components
export component MyButton() {
  <button>{"Click"}</button>
}
```

### Variable Declarations in Templates

You can declare variables inside templates:

```javascript
export component Example() {
  <div>
    {(() => {
      const computed = @value * 2;
      return computed;
    })()}
  </div>
}
```

## File Structure

- Components use `.ripple` extension
- Export components with `export component Name() {}`
- Import components: `import { Component } from './Component.ripple'`
- Mount app: `mount(App, { target: document.getElementById('app')! })`

## Common Imports

```javascript
import { track, effect, mount } from 'ripple';
```
