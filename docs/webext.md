<intro.md>

# Introduction

All of `@webext-core`'s packages are provided via NPM. Depending on your project's setup, you can consume them in 2 different ways:

1. If your project uses a bundler or framework (like Vite, Webpack, WXT, or Plasmo), see [Bundler Setup](#bundler-setup).
2. If your project does not use a bundler, see [Non-bundler Setup](#non-bundler-setup)

## Bundler Setup

If you haven't setup a bundler yet, I recommend using [WXT](https://wxt.dev/) for the best DX and to support all browsers.

```sh
pnpm dlx wxt@latest init
```

Install any of the packages and use them normally. Everything will just work :+1:

```sh
pnpm i @webext-core/storage
```

```ts
import { localExtStorage } from "@webext-core/storage";

const value = await localExtStorage.getItem("some-key");
```

## Non-bundler Setup

If you're not using a bundler, you'll have to download each package and put it inside your project.

::callout
#summary
Why download them?

#content
With Manifest V3, Google doesn't approve of extensions using CDN URLs directly, considering it "remotely hosted code" and a security risk. So you will need to download each package and ship them with your extension. See the [MV3 overview](https://developer.chrome.com/docs/extensions/mv3/intro/mv3-overview/#remotely-hosted-code) for more details.

If you're not on MV3 yet, you could use the CDN, but it's still recommended to download it so it loads faster.
::

All of `@webext-core` NPM packages include a minified, `lib/index.global.js` file that will create a global variable you can use to access the package's APIs.

Lets say you've put all your third-party JS files inside a `vendor/` directory, and want to install the `@webext-core/storage` package.

```
.
├─ vendor
│  └─ jquery.min.js
└─ manifest.json
```

You can download the package like so:

```sh
mkdir -p vendor/webext-core
curl -o vendor/webext-core/storage.js https://cdn.jsdelivr.net/npm/@webext-core/storage/lib/index.global.js
```

You project should now look like this:

```
.
├─ vendor
│  ├─ jquery.min.js
│  └─ webext-core
│     └─ storage.js
└─ manifest.json
```

Now you can include the `vendor/webext-core/storage.js` file in your extension! Each package sets up it's own global variable, so refer to the individual docs for that variable's name. In this case, it's `webExtCoreStorage`.

###### HTML Files

```html
<head>
  <script src="/vendor/webext-core/storage.js"></script>
  <script>
    const { localExtStorage } = webExtCoreStorage;

    const value = await localExtStorage.getItem('some-key');
  </script>
</head>
```

###### Content Scripts

```json
"content_scripts": [{
  "matches": [...],
  "js": ["vendor/webext-core/storage.js", "your-content-script.js"]
}]
```

###### MV2 Background

```json
"background": {
  "scripts": ["vendor/webext-core/storage.js", "your-background-script.js"]
}
```

###### MV3 Background

For MV3 background scripts, you need to use a bundler since `background.service_worker` only accepts a single script.
</intro.md>
<storage.md>

# Installation

:badge[MV2]{type="success"} :badge[MV3]{type="success"} :badge[Chrome]{type="success"} :badge[Firefox]{type="success"} :badge[Safari]{type="success"}

## Overview

`@webext-core/storage` provides a type-safe, `localStorage`-like API for interacting with extension storage.

```ts
const { key: value } = await browser.storage.local.get("key");
// VS
const value = await localExtStorage.getItem("key");
```

::alert{type=warning}
Requires the `storage` permission.
::

## Installation

###### NPM

```sh
pnpm i @webext-core/storage
```

```ts
import { localExtStorage } from "@webext-core/storage";

const value = await localExtStorage.getItem("key");
await localExtStorage.setItem("key", 123);
```

###### CDN

```sh
curl -o storage.js https://cdn.jsdelivr.net/npm/@webext-core/storage/lib/index.global.js
```

```html
<script src="/storage.js"></script>
<script>
  const { localExtStorage } = webExtCoreStorage;

  const value = await localExtStorage.getItem('key');
  await localExtStorage.setItem('key', 123);
</script>
```

## Differences with `localStorage` and `browser.storage`

|                                          | <code style="white-space: nowrap">@webext-core/storage</code> | `localStorage` | `browser.storage` |
| ---------------------------------------- | :-----------------------------------------------------------: | :------------: | :---------------: |
| **Set value to `undefined` removes it?** |                              ✅                               |       ✅       |        ❌         |
| **Returns `null` for missing values?**   |                              ✅                               |       ✅       |        ❌         |
| **Stores non-string values?**            |                              ✅                               |       ❌       |        ✅         |
| **Async?**                               |                              ✅                               |       ❌       |        ✅         |

Otherwise, the storage behaves the same as `localStorage` / `sessionStorage`.

# TypeScript

## Adding Type Safety

If your project uses TypeScript, you can make your own type-safe storage by passing a schema into the first type argument of `defineExtensionStorage`.

```ts
import { defineExtensionStorage } from "@webext-core/storage";
import browser from "webextension-polyfill";

export interface ExtensionStorageSchema {
  installDate: number;
  notificationsEnabled: boolean;
  favoriteUrls: string[];
}

export const extensionStorage = defineExtensionStorage<ExtensionStorageSchema>(
  browser.storage.local,
);
```

Then, when you use this `extensionStorage`, not the one exported from the package, you'll get type errors when using keys not in the schema:

```ts
extensionStorage.getItem("unknownKey");
//                       ~~~~~~~~~~~~ Error: 'unknownKey' does not match `keyof LocalExtStorageSchema`

const installDate: Date = await extensionStorage.getItem("installDate");
//    ~~~~~~~~~~~~~~~~~ Error: value of type 'number' cannot be assigned to type 'Date'

await extensionStorage.setItem("favoriteUrls", "not-an-array");
//                                             ~~~~~~~~~~~~~~ Error: type 'string' is not assignable to 'string[]'
```

When used correctly, types will be automatically inferred without having to specify the type anywhere:

```ts
const installDate /*: number | null */ =
  await extensionStorage.getItem("installDate");
await extensionStorage.setItem("installDate", 123);

const notificationsEnalbed /*: boolean | null */ =
  await extensionStorage.getItem("notificationsEnalbed");

const favorites /*: string[] | null */ =
  await extensionStorage.getItem("favoriteUrls");
favorites ??= [];
favorites.push("https://github.com");
await localExtSTorage.setItem("favoriteUrls", favorites);
```

## Handling `null` Correctly

When using a schema, you'll notice that `getItem` returns `T | null`, but `setItem` requires a non-null value.

By default, getting items from storage could always return `null` if a value hasn't been set. But if you type the schema as required fields, you're only be allowed to set non-null values.

If you want a key to be "optional" in storage, add `null` to it's type, then you'll be able to set the value to `null`.

```ts
export interface LocalExtStorageSchema {
  installDate: number;
  notificationsEnabled: boolean; // [!code --]
  notificationsEnabled: boolean | null; // [!code ++]
  favoriteUrls: string[];
}
```

### Never Use `undefined`

Missing storage values will always be returned as `null`, never as `undefined`. So you shouldn't use `?:` or `| undefined` since that doesn't represent the actual type of your values.

```js
export interface LocalExtStorageSchema {
  key1?: number; // [!code --]
  key2: string | undefined; // [!code --]
  key1: number | null; // [!code ++]
  key2: string | null; // [!code ++]
}
```

<!-- GENERATED FILE, DO NOT EDIT -->

# API Reference

::alert

See [`@webext-core/storage`](/storage/installation/)

::

## `defineExtensionStorage`

```ts
function defineExtensionStorage<TSchema extends AnySchema = AnySchema>(
  storage: Storage.StorageArea,
): ExtensionStorage<TSchema> {
  // ...
}
```

Create a storage instance with an optional schema, `TSchema`, for type safety.

### Parameters

- **_`storage: Storage.StorageArea`_**<br/>The storage to to use. Either `Browser.storage.local`, `Browser.storage.sync`, or `Browser.storage.managed`.

### Examples

```ts
import browser from "webextension-polyfill";

interface Schema {
  installDate: number;
}
const extensionStorage = defineExtensionStorage<Schema>(browser.storage.local);

const date = await extensionStorage.getItem("installDate");
```

## `ExtensionStorage`

```ts
interface ExtensionStorage<TSchema extends AnySchema> {
  clear(): Promise<void>;
  getItem<TKey extends keyof TSchema>(
    key: TKey,
  ): Promise<Required<TSchema>[TKey] | null>;
  setItem<TKey extends keyof TSchema>(
    key: TKey,
    value: TSchema[TKey],
  ): Promise<void>;
  removeItem<TKey extends keyof TSchema>(key: TKey): Promise<void>;
  onChange<TKey extends keyof TSchema>(
    key: TKey,
    cb: OnChangeCallback<TSchema, TKey>,
  ): RemoveListenerCallback;
}
```

This is the interface for the storage objects exported from the package. It is similar to `localStorage`, except for a few differences:

- **_It's async_** since the web extension storage APIs are async.
- It can store any data type, **_not just strings_**.

## `localExtStorage`

```ts
const localExtStorage: ExtensionStorage<AnySchema>;
```

An implementation of `ExtensionStorage` based on the `browser.storage.local` storage area.

## `managedExtStorage`

```ts
const managedExtStorage: ExtensionStorage<AnySchema>;
```

An implementation of `ExtensionStorage` based on the `browser.storage.managed` storage area.

## `sessionExtStorage`

```ts
const sessionExtStorage: ExtensionStorage<AnySchema>;
```

An implementation of `ExtensionStorage` based on the `browser.storage.local` storage area.

- Added to Chrome 102 as of May 24th, 2022.
- Added to Safari 16.4 as of March 27th, 2023.
- Added to Firefox 115 as of July 4th, 2023.

## `syncExtStorage`

```ts
const syncExtStorage: ExtensionStorage<AnySchema>;
```

An implementation of `ExtensionStorage` based on the `browser.storage.sync` storage area.

<br/><br/>

---

_API reference generated by [`docs/generate-api-references.ts`](https://github.com/aklinker1/webext-core/blob/main/docs/generate-api-references.ts)_
</storage.md>

<messaging.md>

# Installation

:badge[MV2]{type="success"} :badge[MV3]{type="success"} :badge[Chrome]{type="success"} :badge[Firefox]{type="success"} :badge[Safari]{type="success"}

## Overview

`@webext-core/messaging` a simplified, type-safe wrapper around the web extension messaging APIs. It also provides a similar interface for communicating with web pages or injected scripts.

::alert
Don't like lower-level messaging APIs? Try out [`@webext-core/proxy-service`](/proxy-service/installation) for a more DX-friendly approach to executing code in the background script.
::

## Installation

###### NPM

```sh
pnpm i @webext-core/messaging
```

```ts
import { defineExtensionMessaging } from "@webext-core/messaging";
```

###### CDN

```sh
curl -o messaging.js https://cdn.jsdelivr.net/npm/@webext-core/messaging/lib/index.global.js
```

```html
<script src="/messaging.js"></script>
<script>
  const { defineExtensionMessaging } = webExtCoreMessaging;
</script>
```

## Basic Usage

First, define a protocol map:

::code-group

```ts [messaging.ts]
interface ProtocolMap {
  getStringLength(data: string): number;
}
```

::

Then call `defineExtensionMessaging`, passing your `ProtocolMap` as the first type parameter.

Export the `sendMessage` and `onMessage` methods. These are what the rest of your extension will use to pass messages around.

::code-group

```ts [messaging.ts]
import { defineExtensionMessaging } from "@webext-core/messaging";

interface ProtocolMap {
  getStringLength(data: string): number;
}

export const { sendMessage, onMessage } =
  defineExtensionMessaging<ProtocolMap>();
```

::

Usually the `onMessage` function will be used in the background and messages will be sent from other parts of the extension.

::code-group

```ts [background.ts]
import { onMessage } from "./messaging";

onMessage("getStringLength", (message) => {
  return message.data.length;
});
```

```ts [content-script.ts]
import { sendMessage } from "./messaging";

const length = await sendMessage("getStringLength", "hello world");

console.log(length); // 11
```

::

### Sending Messages to Tabs

You can also send messages from your background script to a tab, but you need to know the `tabId`. This would send the message to all frames in the tab.

If you want to send a message to a specific frame, you can pass an object to `sendMessage` with the `tabId` and `frameId`.

::code-group

```ts [content-script.ts]
import { onMessage } from "./messaging";

onMessage("getStringLength", (message) => {
  return message.data.length;
});
```

```ts [background.ts]
import { sendMessage } from "./messaging";

const length = await sendMessage("getStringLength", "hello world", tabId);
const length = await sendMessage("getStringLength", "hello world", {
  tabId,
  frameId,
});
```

::

## Window Messaging

Inside a content script, you may need to communicate with a webpage or an injected script running in the page's JS context. In this case, you can use `defineWindowMessenger` or `defineCustomEventMessenger`, which use the `window.postMessage` and `CustomEvent` APIs respectively.

::code-group

```ts [Window]
import { defineWindowMessaging } from "@webext-core/messaging/page";

export interface WebsiteMessengerSchema {
  init(data: unknown): void;
  somethingHappened(data: unknown): void;
}

export const websiteMessenger = defineWindowMessaging<WebsiteMessengerSchema>({
  namespace: "<some-unique-string>",
});
```

```ts [Custom Event]
import { defineCustomEventMessaging } from "@webext-core/messaging/page";

export interface WebsiteMessengerSchema {
  init(data: unknown): void;
  somethingHappened(data: unknown): void;
}

export const websiteMessenger =
  defineCustomEventMessaging<WebsiteMessengerSchema>({
    namespace: "<some-unique-string>",
  });
```

::

::callout
#summary
Which one should I use?
#content
In general, if you don't need to communicate with iframes, use `defineCustomEventMessaging`. If you need to communicate with iframes, use `defineWindowMessaging`.
::

Note the namespace option. Only messengers of the same type (window vs custom event) and same namespace will communicate. This prevents accidentially reacting to messages from the page or from another extension. Usually, it should be a unique string for your extension. The easiest method is to set it to `browser.runtime.id`, but if you're injecting a script, `webextension-polyfill` will not be available in the page context and you'll have to use something else or hardcode the extension's ID.

The messenger object can be used in the same way as the extension messenger, with `sendMessage` and `onMessage`.

Here, we're injecting a script, initializing it with data, and allowing the script to send data back to our content script.

::code-group

```ts [Content Script]
import { websiteMessenger } from './website-messaging';

const script = document.createElement('script');
script.src = browser.runtime.getURL('/path/to/injected.js');
document.head.appendChild(script);

script.onload = () => {
  websiteMessenger.sendMessage('init', { ... });
};

websiteMessenger.onMessage('somethingHappened', (data) => {
  // React to messages from the injected script
});
```

```ts [Injected script]
import { websiteMessenger } from './website-messaging';

websiteMessenger.onMessage('init', data => {
  // initialize injected script

  // eventually, send data back to the content script
  websiteMessenger.sendMessage('somethingHappened', { ... });
});
```

::

# Protocol Maps

::alert
Only relevant to TypeScript projects.
::

## Overview

Protocol maps define types for `sendMessage` and `onMessage` in a single place. You'll never need to write type parameters; the data and return types will be inferred automatically!

## Syntax

Protocol maps are simple interfaces passed into `defineExtensionMessaging`. They specify a list of valid message types, as well as each message's data type and return type.

<!-- prettier-ignore -->
```ts
interface ProtocolMap {
  message1(): void;                // No data and no return type
  message2(data: string): void;    // Only data
  message3(): boolean;             // Only a return type
  message4(data: string): boolean; // Data and return type
}

export const { sendMessage, onMessage } = defineExtensionMessaging<ProtocolMap>();
```

When calling `sendMessage` or `onMessage`, all the types will be inferred:

```ts
onMessage("message2", ({ data /* string */ }) /* : void */ => {});
onMessage("message3", (message) /* : boolean */ => true);

const res /* : boolean */ = await sendMessage("message3", undefined);
const res /* : boolean */ = await sendMessage("message4", "text");
```

## Async Messages

All messages are async. In your protocol map, you don't need to make the return type `Promise<T>`, `T` will work just fine.

```ts
interface ProtocolMap {
  someMessage(): string; // [!code ++]
  someMessage(): Promise<string>; // [!code --]
}
```

## Multiple Arguments

Protocol map functions should be defined with a single parameter, `data`. To pass more than one argument, make the `data` parameter an object instead!

```ts
interface ProtocolMap {
  someMessage(data: { arg1: string; arg2: boolean }): void; // [!code ++]
  someMessage(arg1: string, arg2: boolean): void; // [!code --]
}
```

```ts
await sendMessage('someMessage', { arg1: ..., arg2: ... });
```

<!-- GENERATED FILE, DO NOT EDIT -->

# API Reference

::alert

See [`@webext-core/messaging`](/messaging/installation/)

::

## `BaseMessagingConfig`

```ts
interface BaseMessagingConfig {
  logger?: Logger;
  breakError?: boolean;
}
```

Shared configuration between all the different messengers.

### Properties

- **_`logger?: Logger`_** (default: `console`)<br/>The logger to use when logging messages. Set to `null` to disable logging.

- **_`breakError?: boolean`_** (default: `undefined`)<br/>Whether to break an error when an invalid message is received.

## `CustomEventMessage`

```ts
interface CustomEventMessage {
  event: CustomEvent;
}
```

Additional fields available on the `Message` from a `CustomEventMessenger`.

### Properties

- **_`event: CustomEvent`_**<br/>The event that was fired, resulting in the message being passed.

## `CustomEventMessagingConfig`

```ts
interface CustomEventMessagingConfig extends NamespaceMessagingConfig {}
```

Configuration passed into `defineCustomEventMessaging`.

## `CustomEventMessenger`

```ts
type CustomEventMessenger<TProtocolMap extends Record<string, any>> =
  GenericMessenger<TProtocolMap, CustomEventMessage, []>;
```

Messenger returned by `defineCustomEventMessenger`.

## `defineCustomEventMessaging`

```ts
function defineCustomEventMessaging<
  TProtocolMap extends Record<string, any> = Record<string, any>,
>(config: CustomEventMessagingConfig): CustomEventMessenger<TProtocolMap> {
  // ...
}
```

Creates a `CustomEventMessenger`. This messenger is backed by the `CustomEvent` APIs. It can be
used to communicate between:

- Content script and website
- Content script and injected script

`sendMessage` does not accept any additional arguments..

### Examples

```ts
interface WebsiteMessengerSchema {
  initInjectedScript(data: ...): void;
}

export const websiteMessenger = defineCustomEventMessenger<initInjectedScript>();

// Content script
websiteMessenger.sendMessage("initInjectedScript", ...);

// Injected script
websiteMessenger.onMessage("initInjectedScript", (...) => {
  // ...
})

*
```

## `defineExtensionMessaging`

```ts
function defineExtensionMessaging<
  TProtocolMap extends Record<string, any> = Record<string, any>,
>(config?: ExtensionMessagingConfig): ExtensionMessenger<TProtocolMap> {
  // ...
}
```

Returns an `ExtensionMessenger` that is backed by the `browser.runtime.sendMessage` and
`browser.tabs.sendMessage` APIs.

It can be used to send messages to and from the background page/service worker.

## `defineWindowMessaging`

```ts
function defineWindowMessaging<
  TProtocolMap extends Record<string, any> = Record<string, any>,
>(config: WindowMessagingConfig): WindowMessenger<TProtocolMap> {
  // ...
}
```

Returns a `WindowMessenger`. It is backed by the `window.postMessage` API. It can be used to
communicate between:

- Content script and website
- Content script and injected script

### Examples

```ts
interface WebsiteMessengerSchema {
  initInjectedScript(data: ...): void;
}

export const websiteMessenger = defineWindowMessaging<initInjectedScript>();

// Content script
websiteMessenger.sendMessage("initInjectedScript", ...);

// Injected script
websiteMessenger.onMessage("initInjectedScript", (...) => {
  // ...
})
```

## `ExtensionMessage`

```ts
interface ExtensionMessage {
  sender: Runtime.MessageSender;
}
```

Additional fields available on the `Message` from an `ExtensionMessenger`.

### Properties

- **_`sender: Runtime.MessageSender`_**<br/>Information about where the message came from. See
  [`Runtime.MessageSender`](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/runtime/MessageSender).

## `ExtensionMessagingConfig`

```ts
interface ExtensionMessagingConfig extends BaseMessagingConfig {}
```

Configuration passed into `defineExtensionMessaging`.

## `ExtensionMessenger`

```ts
type ExtensionMessenger<TProtocolMap extends Record<string, any>> =
  GenericMessenger<TProtocolMap, ExtensionMessage, ExtensionSendMessageArgs>;
```

Messenger returned by `defineExtensionMessaging`.

## `ExtensionSendMessageArgs`

```ts
type ExtensionSendMessageArgs = [arg?: number | SendMessageOptions];
```

Send message accepts either:

- No arguments to send to background
- A tabId number to send to a specific tab
- A SendMessageOptions object to target a specific tab and frame

You cannot message between tabs directly. It must go through the background script.

## `GenericMessenger`

```ts
interface GenericMessenger<
  TProtocolMap extends Record<string, any>,
  TMessageExtension,
  TSendMessageArgs extends any[],
> {
  sendMessage<TType extends keyof TProtocolMap>(
    type: TType,
    data: GetDataType<TProtocolMap[TType]>,
    ...args: TSendMessageArgs
  ): Promise<GetReturnType<TProtocolMap[TType]>>;
  onMessage<TType extends keyof TProtocolMap>(
    type: TType,
    onReceived: (
      message: Message<TProtocolMap, TType> & TMessageExtension,
    ) => void | MaybePromise<GetReturnType<TProtocolMap[TType]>>,
  ): RemoveListenerCallback;
  removeAllListeners(): void;
}
```

Messaging interface shared by all messengers.

Type parameters accept:

- `TProtocolMap` to define the data and return types of messages.
- `TMessageExtension` to define additional fields that are available on a message inside
  `onMessage`'s callback
- `TSendMessageArgs` to define a list of additional arguments for `sendMessage`

## `GetDataType`

```ts
type GetDataType<T> = T extends (...args: infer Args) => any
  ? Args["length"] extends 0 | 1
    ? Args[0]
    : never
  : T extends ProtocolWithReturn<any, any>
    ? T["BtVgCTPYZu"]
    : T;
```

Given a function declaration, `ProtocolWithReturn`, or a value, return the message's data type.

## `GetReturnType`

```ts
type GetReturnType<T> = T extends (...args: any[]) => infer R
  ? R
  : T extends ProtocolWithReturn<any, any>
    ? T["RrhVseLgZW"]
    : void;
```

Given a function declaration, `ProtocolWithReturn`, or a value, return the message's return type.

## `Logger`

```ts
interface Logger {
  debug(...args: any[]): void;
  log(...args: any[]): void;
  warn(...args: any[]): void;
  error(...args: any[]): void;
}
```

Interface used to log text to the console when sending and receiving messages.

## `MaybePromise`

```ts
type MaybePromise<T> = Promise<T> | T;
```

Either a Promise of a type, or that type directly. Used to indicate that a method can by sync or
async.

## `Message`

```ts
interface Message<
  TProtocolMap extends Record<string, any>,
  TType extends keyof TProtocolMap,
> {
  id: number;
  data: GetDataType<TProtocolMap[TType]>;
  type: TType;
  timestamp: number;
}
```

Contains information about the message received.

### Properties

- **_`id: number`_**<br/>A semi-unique, auto-incrementing number used to trace messages being sent.

- **_`data: GetDataType<TProtocolMap[TType]>`_**<br/>The data that was passed into `sendMessage`

- **_`type: TType`_**

- **_`timestamp: number`_**<br/>The timestamp the message was sent in MS since epoch.

## `MessageSender`

```ts
interface MessageSender {
  tab?: Tabs.Tab;
  frameId?: number;
  id?: string;
  url?: string;
}
```

An object containing information about the script context that sent a message or request.

### Properties

- **_`tab?: Tabs.Tab`_**<br/>The $(ref:tabs.Tab) which opened the connection, if any. This property will <strong>only</strong>
  be present when the connection was opened from a tab (including content scripts), and <strong>only</strong>
  if the receiver is an extension, not an app.
  Optional.

- **_`frameId?: number`_**<br/>The $(topic:frame_ids)[frame] that opened the connection. 0 for top-level frames, positive for child frames.
  This will only be set when <code>tab</code> is set.
  Optional.

- **_`id?: string`_**<br/>The ID of the extension or app that opened the connection, if any.
  Optional.

- **_`url?: string`_**<br/>The URL of the page or frame that opened the connection. If the sender is in an iframe,
  it will be iframe's URL not the URL of the page which hosts it.
  Optional.

## `NamespaceMessagingConfig`

```ts
interface NamespaceMessagingConfig extends BaseMessagingConfig {
  namespace: string;
}
```

### Properties

- **_`namespace: string`_**<br/>A string used to ensure the messenger only sends messages to and listens for messages from
  other messengers of the same type, with the same namespace.

## `ProtocolWithReturn`

:::danger Deprecated
Use the function syntax instead: <https://webext-core.aklinker1.io/guide/messaging/protocol-maps.html#syntax>
:::

```ts
interface ProtocolWithReturn<TData, TReturn> {
  BtVgCTPYZu: TData;
  RrhVseLgZW: TReturn;
}
```

Used to add a return type to a message in the protocol map.

> Internally, this is just an object with random keys for the data and return types.

### Properties

- **_`BtVgCTPYZu: TData`_**<br/>Stores the data type. Randomly named so that it isn't accidentally implemented.

- **_`RrhVseLgZW: TReturn`_**<br/>Stores the return type. Randomly named so that it isn't accidentally implemented.

### Examples

```ts
interface ProtocolMap {
  // data is a string, returns undefined
  type1: string;
  // data is a string, returns a number
  type2: ProtocolWithReturn<string, number>;
}
```

## `RemoveListenerCallback`

```ts
type RemoveListenerCallback = () => void;
```

Call to ensure an active listener has been removed.

If the listener has already been removed with `Messenger.removeAllListeners`, this is a noop.

## `SendMessageOptions`

```ts
interface SendMessageOptions {
  tabId: number;
  frameId?: number;
}
```

Options for sending a message to a specific tab/frame

### Properties

- **_`tabId: number`_**<br/>The tab to send a message to

- **_`frameId?: number`_**<br/>The frame to send a message to. 0 represents the main frame.

## `WindowMessagingConfig`

```ts
interface WindowMessagingConfig extends NamespaceMessagingConfig {}
```

Configuration passed into `defineWindowMessaging`.

## `WindowMessenger`

```ts
type WindowMessenger<TProtocolMap extends Record<string, any>> =
  GenericMessenger<TProtocolMap, {}, WindowSendMessageArgs>;
```

## `WindowSendMessageArgs`

```ts
type WindowSendMessageArgs = [targetOrigin?: string];
```

For a `WindowMessenger`, `sendMessage` requires an additional argument, the `targetOrigin`. It
defines which frames inside the page should receive the message.

> See <https://developer.mozilla.org/en-US/docs/Web/API/Window/postMessage#targetorigin> for more
> details.

<br/><br/>

---

_API reference generated by [`docs/generate-api-references.ts`](https://github.com/aklinker1/webext-core/blob/main/docs/generate-api-references.ts)_
</messaging.md>
