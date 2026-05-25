# Generated TypeScript README
This README will guide you through the process of using the generated JavaScript SDK package for the connector `tiennuoc`. It will also provide examples on how to use your generated SDK to call your Data Connect queries and mutations.

***NOTE:** This README is generated alongside the generated SDK. If you make changes to this file, they will be overwritten when the SDK is regenerated.*

# Table of Contents
- [**Overview**](#generated-javascript-readme)
- [**Accessing the connector**](#accessing-the-connector)
  - [*Connecting to the local Emulator*](#connecting-to-the-local-emulator)
- [**Queries**](#queries)
  - [*GetUserByPhone*](#getuserbyphone)
  - [*GetUserById*](#getuserbyid)
  - [*GetUserByFirebaseUid*](#getuserbyfirebaseuid)
  - [*GetMe*](#getme)
  - [*ListUsers*](#listusers)
- [**Mutations**](#mutations)
  - [*UpsertUserById*](#upsertuserbyid)
  - [*UpdateUserFirebaseUid*](#updateuserfirebaseuid)
  - [*UpdateUserPasswordHash*](#updateuserpasswordhash)
  - [*CreateAuditLog*](#createauditlog)

# Accessing the connector
A connector is a collection of Queries and Mutations. One SDK is generated for each connector - this SDK is generated for the connector `tiennuoc`. You can find more information about connectors in the [Data Connect documentation](https://firebase.google.com/docs/data-connect#how-does).

You can use this generated SDK by importing from the package `@tiennuoc/dataconnect` as shown below. Both CommonJS and ESM imports are supported.

You can also follow the instructions from the [Data Connect documentation](https://firebase.google.com/docs/data-connect/web-sdk#set-client).

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig } from '@tiennuoc/dataconnect';

const dataConnect = getDataConnect(connectorConfig);
```

## Connecting to the local Emulator
By default, the connector will connect to the production service.

To connect to the emulator, you can use the following code.
You can also follow the emulator instructions from the [Data Connect documentation](https://firebase.google.com/docs/data-connect/web-sdk#instrument-clients).

```typescript
import { connectDataConnectEmulator, getDataConnect } from 'firebase/data-connect';
import { connectorConfig } from '@tiennuoc/dataconnect';

const dataConnect = getDataConnect(connectorConfig);
connectDataConnectEmulator(dataConnect, 'localhost', 9399);
```

After it's initialized, you can call your Data Connect [queries](#queries) and [mutations](#mutations) from your generated SDK.

# Queries

There are two ways to execute a Data Connect Query using the generated Web SDK:
- Using a Query Reference function, which returns a `QueryRef`
  - The `QueryRef` can be used as an argument to `executeQuery()`, which will execute the Query and return a `QueryPromise`
- Using an action shortcut function, which returns a `QueryPromise`
  - Calling the action shortcut function will execute the Query and return a `QueryPromise`

The following is true for both the action shortcut function and the `QueryRef` function:
- The `QueryPromise` returned will resolve to the result of the Query once it has finished executing
- If the Query accepts arguments, both the action shortcut function and the `QueryRef` function accept a single argument: an object that contains all the required variables (and the optional variables) for the Query
- Both functions can be called with or without passing in a `DataConnect` instance as an argument. If no `DataConnect` argument is passed in, then the generated SDK will call `getDataConnect(connectorConfig)` behind the scenes for you.

Below are examples of how to use the `tiennuoc` connector's generated functions to execute each query. You can also follow the examples from the [Data Connect documentation](https://firebase.google.com/docs/data-connect/web-sdk#using-queries).

## GetUserByPhone
You can execute the `GetUserByPhone` query using the following action shortcut function, or by calling `executeQuery()` after calling the following `QueryRef` function, both of which are defined in [dataconnect/index.d.ts](./index.d.ts):
```typescript
getUserByPhone(vars: GetUserByPhoneVariables, options?: ExecuteQueryOptions): QueryPromise<GetUserByPhoneData, GetUserByPhoneVariables>;

interface GetUserByPhoneRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: GetUserByPhoneVariables): QueryRef<GetUserByPhoneData, GetUserByPhoneVariables>;
}
export const getUserByPhoneRef: GetUserByPhoneRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
getUserByPhone(dc: DataConnect, vars: GetUserByPhoneVariables, options?: ExecuteQueryOptions): QueryPromise<GetUserByPhoneData, GetUserByPhoneVariables>;

interface GetUserByPhoneRef {
  ...
  (dc: DataConnect, vars: GetUserByPhoneVariables): QueryRef<GetUserByPhoneData, GetUserByPhoneVariables>;
}
export const getUserByPhoneRef: GetUserByPhoneRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the getUserByPhoneRef:
```typescript
const name = getUserByPhoneRef.operationName;
console.log(name);
```

### Variables
The `GetUserByPhone` query requires an argument of type `GetUserByPhoneVariables`, which is defined in [dataconnect/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface GetUserByPhoneVariables {
  phone: string;
}
```
### Return Type
Recall that executing the `GetUserByPhone` query returns a `QueryPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `GetUserByPhoneData`, which is defined in [dataconnect/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface GetUserByPhoneData {
  users: ({
    id: UUIDString;
    phone: string;
    firebaseUid?: string | null;
    passwordHash?: string | null;
    name: string;
    role: UserRole;
    household_on_user?: {
      id: UUIDString;
      householdCode: string;
    } & Household_Key;
  } & User_Key)[];
}
```
### Using `GetUserByPhone`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, getUserByPhone, GetUserByPhoneVariables } from '@tiennuoc/dataconnect';

// The `GetUserByPhone` query requires an argument of type `GetUserByPhoneVariables`:
const getUserByPhoneVars: GetUserByPhoneVariables = {
  phone: ..., 
};

// Call the `getUserByPhone()` function to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await getUserByPhone(getUserByPhoneVars);
// Variables can be defined inline as well.
const { data } = await getUserByPhone({ phone: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await getUserByPhone(dataConnect, getUserByPhoneVars);

console.log(data.users);

// Or, you can use the `Promise` API.
getUserByPhone(getUserByPhoneVars).then((response) => {
  const data = response.data;
  console.log(data.users);
});
```

### Using `GetUserByPhone`'s `QueryRef` function

```typescript
import { getDataConnect, executeQuery } from 'firebase/data-connect';
import { connectorConfig, getUserByPhoneRef, GetUserByPhoneVariables } from '@tiennuoc/dataconnect';

// The `GetUserByPhone` query requires an argument of type `GetUserByPhoneVariables`:
const getUserByPhoneVars: GetUserByPhoneVariables = {
  phone: ..., 
};

// Call the `getUserByPhoneRef()` function to get a reference to the query.
const ref = getUserByPhoneRef(getUserByPhoneVars);
// Variables can be defined inline as well.
const ref = getUserByPhoneRef({ phone: ..., });

// You can also pass in a `DataConnect` instance to the `QueryRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = getUserByPhoneRef(dataConnect, getUserByPhoneVars);

// Call `executeQuery()` on the reference to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeQuery(ref);

console.log(data.users);

// Or, you can use the `Promise` API.
executeQuery(ref).then((response) => {
  const data = response.data;
  console.log(data.users);
});
```

## GetUserById
You can execute the `GetUserById` query using the following action shortcut function, or by calling `executeQuery()` after calling the following `QueryRef` function, both of which are defined in [dataconnect/index.d.ts](./index.d.ts):
```typescript
getUserById(vars: GetUserByIdVariables, options?: ExecuteQueryOptions): QueryPromise<GetUserByIdData, GetUserByIdVariables>;

interface GetUserByIdRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: GetUserByIdVariables): QueryRef<GetUserByIdData, GetUserByIdVariables>;
}
export const getUserByIdRef: GetUserByIdRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
getUserById(dc: DataConnect, vars: GetUserByIdVariables, options?: ExecuteQueryOptions): QueryPromise<GetUserByIdData, GetUserByIdVariables>;

interface GetUserByIdRef {
  ...
  (dc: DataConnect, vars: GetUserByIdVariables): QueryRef<GetUserByIdData, GetUserByIdVariables>;
}
export const getUserByIdRef: GetUserByIdRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the getUserByIdRef:
```typescript
const name = getUserByIdRef.operationName;
console.log(name);
```

### Variables
The `GetUserById` query requires an argument of type `GetUserByIdVariables`, which is defined in [dataconnect/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface GetUserByIdVariables {
  id: UUIDString;
}
```
### Return Type
Recall that executing the `GetUserById` query returns a `QueryPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `GetUserByIdData`, which is defined in [dataconnect/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface GetUserByIdData {
  user?: {
    id: UUIDString;
    phone: string;
    firebaseUid?: string | null;
    name: string;
    role: UserRole;
    household_on_user?: {
      id: UUIDString;
    } & Household_Key;
  } & User_Key;
}
```
### Using `GetUserById`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, getUserById, GetUserByIdVariables } from '@tiennuoc/dataconnect';

// The `GetUserById` query requires an argument of type `GetUserByIdVariables`:
const getUserByIdVars: GetUserByIdVariables = {
  id: ..., 
};

// Call the `getUserById()` function to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await getUserById(getUserByIdVars);
// Variables can be defined inline as well.
const { data } = await getUserById({ id: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await getUserById(dataConnect, getUserByIdVars);

console.log(data.user);

// Or, you can use the `Promise` API.
getUserById(getUserByIdVars).then((response) => {
  const data = response.data;
  console.log(data.user);
});
```

### Using `GetUserById`'s `QueryRef` function

```typescript
import { getDataConnect, executeQuery } from 'firebase/data-connect';
import { connectorConfig, getUserByIdRef, GetUserByIdVariables } from '@tiennuoc/dataconnect';

// The `GetUserById` query requires an argument of type `GetUserByIdVariables`:
const getUserByIdVars: GetUserByIdVariables = {
  id: ..., 
};

// Call the `getUserByIdRef()` function to get a reference to the query.
const ref = getUserByIdRef(getUserByIdVars);
// Variables can be defined inline as well.
const ref = getUserByIdRef({ id: ..., });

// You can also pass in a `DataConnect` instance to the `QueryRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = getUserByIdRef(dataConnect, getUserByIdVars);

// Call `executeQuery()` on the reference to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeQuery(ref);

console.log(data.user);

// Or, you can use the `Promise` API.
executeQuery(ref).then((response) => {
  const data = response.data;
  console.log(data.user);
});
```

## GetUserByFirebaseUid
You can execute the `GetUserByFirebaseUid` query using the following action shortcut function, or by calling `executeQuery()` after calling the following `QueryRef` function, both of which are defined in [dataconnect/index.d.ts](./index.d.ts):
```typescript
getUserByFirebaseUid(vars: GetUserByFirebaseUidVariables, options?: ExecuteQueryOptions): QueryPromise<GetUserByFirebaseUidData, GetUserByFirebaseUidVariables>;

interface GetUserByFirebaseUidRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: GetUserByFirebaseUidVariables): QueryRef<GetUserByFirebaseUidData, GetUserByFirebaseUidVariables>;
}
export const getUserByFirebaseUidRef: GetUserByFirebaseUidRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
getUserByFirebaseUid(dc: DataConnect, vars: GetUserByFirebaseUidVariables, options?: ExecuteQueryOptions): QueryPromise<GetUserByFirebaseUidData, GetUserByFirebaseUidVariables>;

interface GetUserByFirebaseUidRef {
  ...
  (dc: DataConnect, vars: GetUserByFirebaseUidVariables): QueryRef<GetUserByFirebaseUidData, GetUserByFirebaseUidVariables>;
}
export const getUserByFirebaseUidRef: GetUserByFirebaseUidRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the getUserByFirebaseUidRef:
```typescript
const name = getUserByFirebaseUidRef.operationName;
console.log(name);
```

### Variables
The `GetUserByFirebaseUid` query requires an argument of type `GetUserByFirebaseUidVariables`, which is defined in [dataconnect/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface GetUserByFirebaseUidVariables {
  uid: string;
}
```
### Return Type
Recall that executing the `GetUserByFirebaseUid` query returns a `QueryPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `GetUserByFirebaseUidData`, which is defined in [dataconnect/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface GetUserByFirebaseUidData {
  users: ({
    id: UUIDString;
    phone: string;
    firebaseUid?: string | null;
    name: string;
    role: UserRole;
    household_on_user?: {
      id: UUIDString;
      householdCode: string;
      meterCode: string;
    } & Household_Key;
  } & User_Key)[];
}
```
### Using `GetUserByFirebaseUid`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, getUserByFirebaseUid, GetUserByFirebaseUidVariables } from '@tiennuoc/dataconnect';

// The `GetUserByFirebaseUid` query requires an argument of type `GetUserByFirebaseUidVariables`:
const getUserByFirebaseUidVars: GetUserByFirebaseUidVariables = {
  uid: ..., 
};

// Call the `getUserByFirebaseUid()` function to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await getUserByFirebaseUid(getUserByFirebaseUidVars);
// Variables can be defined inline as well.
const { data } = await getUserByFirebaseUid({ uid: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await getUserByFirebaseUid(dataConnect, getUserByFirebaseUidVars);

console.log(data.users);

// Or, you can use the `Promise` API.
getUserByFirebaseUid(getUserByFirebaseUidVars).then((response) => {
  const data = response.data;
  console.log(data.users);
});
```

### Using `GetUserByFirebaseUid`'s `QueryRef` function

```typescript
import { getDataConnect, executeQuery } from 'firebase/data-connect';
import { connectorConfig, getUserByFirebaseUidRef, GetUserByFirebaseUidVariables } from '@tiennuoc/dataconnect';

// The `GetUserByFirebaseUid` query requires an argument of type `GetUserByFirebaseUidVariables`:
const getUserByFirebaseUidVars: GetUserByFirebaseUidVariables = {
  uid: ..., 
};

// Call the `getUserByFirebaseUidRef()` function to get a reference to the query.
const ref = getUserByFirebaseUidRef(getUserByFirebaseUidVars);
// Variables can be defined inline as well.
const ref = getUserByFirebaseUidRef({ uid: ..., });

// You can also pass in a `DataConnect` instance to the `QueryRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = getUserByFirebaseUidRef(dataConnect, getUserByFirebaseUidVars);

// Call `executeQuery()` on the reference to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeQuery(ref);

console.log(data.users);

// Or, you can use the `Promise` API.
executeQuery(ref).then((response) => {
  const data = response.data;
  console.log(data.users);
});
```

## GetMe
You can execute the `GetMe` query using the following action shortcut function, or by calling `executeQuery()` after calling the following `QueryRef` function, both of which are defined in [dataconnect/index.d.ts](./index.d.ts):
```typescript
getMe(options?: ExecuteQueryOptions): QueryPromise<GetMeData, undefined>;

interface GetMeRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (): QueryRef<GetMeData, undefined>;
}
export const getMeRef: GetMeRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
getMe(dc: DataConnect, options?: ExecuteQueryOptions): QueryPromise<GetMeData, undefined>;

interface GetMeRef {
  ...
  (dc: DataConnect): QueryRef<GetMeData, undefined>;
}
export const getMeRef: GetMeRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the getMeRef:
```typescript
const name = getMeRef.operationName;
console.log(name);
```

### Variables
The `GetMe` query has no variables.
### Return Type
Recall that executing the `GetMe` query returns a `QueryPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `GetMeData`, which is defined in [dataconnect/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface GetMeData {
  users: ({
    id: UUIDString;
    phone: string;
    name: string;
    role: UserRole;
    household_on_user?: {
      id: UUIDString;
      householdCode: string;
      meterCode: string;
    } & Household_Key;
  } & User_Key)[];
}
```
### Using `GetMe`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, getMe } from '@tiennuoc/dataconnect';


// Call the `getMe()` function to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await getMe();

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await getMe(dataConnect);

console.log(data.users);

// Or, you can use the `Promise` API.
getMe().then((response) => {
  const data = response.data;
  console.log(data.users);
});
```

### Using `GetMe`'s `QueryRef` function

```typescript
import { getDataConnect, executeQuery } from 'firebase/data-connect';
import { connectorConfig, getMeRef } from '@tiennuoc/dataconnect';


// Call the `getMeRef()` function to get a reference to the query.
const ref = getMeRef();

// You can also pass in a `DataConnect` instance to the `QueryRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = getMeRef(dataConnect);

// Call `executeQuery()` on the reference to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeQuery(ref);

console.log(data.users);

// Or, you can use the `Promise` API.
executeQuery(ref).then((response) => {
  const data = response.data;
  console.log(data.users);
});
```

## ListUsers
You can execute the `ListUsers` query using the following action shortcut function, or by calling `executeQuery()` after calling the following `QueryRef` function, both of which are defined in [dataconnect/index.d.ts](./index.d.ts):
```typescript
listUsers(vars?: ListUsersVariables, options?: ExecuteQueryOptions): QueryPromise<ListUsersData, ListUsersVariables>;

interface ListUsersRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars?: ListUsersVariables): QueryRef<ListUsersData, ListUsersVariables>;
}
export const listUsersRef: ListUsersRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
listUsers(dc: DataConnect, vars?: ListUsersVariables, options?: ExecuteQueryOptions): QueryPromise<ListUsersData, ListUsersVariables>;

interface ListUsersRef {
  ...
  (dc: DataConnect, vars?: ListUsersVariables): QueryRef<ListUsersData, ListUsersVariables>;
}
export const listUsersRef: ListUsersRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the listUsersRef:
```typescript
const name = listUsersRef.operationName;
console.log(name);
```

### Variables
The `ListUsers` query has an optional argument of type `ListUsersVariables`, which is defined in [dataconnect/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface ListUsersVariables {
  limit?: number | null;
}
```
### Return Type
Recall that executing the `ListUsers` query returns a `QueryPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `ListUsersData`, which is defined in [dataconnect/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface ListUsersData {
  users: ({
    id: UUIDString;
    phone: string;
    name: string;
    role: UserRole;
    firebaseUid?: string | null;
  } & User_Key)[];
}
```
### Using `ListUsers`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, listUsers, ListUsersVariables } from '@tiennuoc/dataconnect';

// The `ListUsers` query has an optional argument of type `ListUsersVariables`:
const listUsersVars: ListUsersVariables = {
  limit: ..., // optional
};

// Call the `listUsers()` function to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await listUsers(listUsersVars);
// Variables can be defined inline as well.
const { data } = await listUsers({ limit: ..., });
// Since all variables are optional for this query, you can omit the `ListUsersVariables` argument.
const { data } = await listUsers();

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await listUsers(dataConnect, listUsersVars);

console.log(data.users);

// Or, you can use the `Promise` API.
listUsers(listUsersVars).then((response) => {
  const data = response.data;
  console.log(data.users);
});
```

### Using `ListUsers`'s `QueryRef` function

```typescript
import { getDataConnect, executeQuery } from 'firebase/data-connect';
import { connectorConfig, listUsersRef, ListUsersVariables } from '@tiennuoc/dataconnect';

// The `ListUsers` query has an optional argument of type `ListUsersVariables`:
const listUsersVars: ListUsersVariables = {
  limit: ..., // optional
};

// Call the `listUsersRef()` function to get a reference to the query.
const ref = listUsersRef(listUsersVars);
// Variables can be defined inline as well.
const ref = listUsersRef({ limit: ..., });
// Since all variables are optional for this query, you can omit the `ListUsersVariables` argument.
const ref = listUsersRef();

// You can also pass in a `DataConnect` instance to the `QueryRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = listUsersRef(dataConnect, listUsersVars);

// Call `executeQuery()` on the reference to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeQuery(ref);

console.log(data.users);

// Or, you can use the `Promise` API.
executeQuery(ref).then((response) => {
  const data = response.data;
  console.log(data.users);
});
```

# Mutations

There are two ways to execute a Data Connect Mutation using the generated Web SDK:
- Using a Mutation Reference function, which returns a `MutationRef`
  - The `MutationRef` can be used as an argument to `executeMutation()`, which will execute the Mutation and return a `MutationPromise`
- Using an action shortcut function, which returns a `MutationPromise`
  - Calling the action shortcut function will execute the Mutation and return a `MutationPromise`

The following is true for both the action shortcut function and the `MutationRef` function:
- The `MutationPromise` returned will resolve to the result of the Mutation once it has finished executing
- If the Mutation accepts arguments, both the action shortcut function and the `MutationRef` function accept a single argument: an object that contains all the required variables (and the optional variables) for the Mutation
- Both functions can be called with or without passing in a `DataConnect` instance as an argument. If no `DataConnect` argument is passed in, then the generated SDK will call `getDataConnect(connectorConfig)` behind the scenes for you.

Below are examples of how to use the `tiennuoc` connector's generated functions to execute each mutation. You can also follow the examples from the [Data Connect documentation](https://firebase.google.com/docs/data-connect/web-sdk#using-mutations).

## UpsertUserById
You can execute the `UpsertUserById` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect/index.d.ts](./index.d.ts):
```typescript
upsertUserById(vars: UpsertUserByIdVariables): MutationPromise<UpsertUserByIdData, UpsertUserByIdVariables>;

interface UpsertUserByIdRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: UpsertUserByIdVariables): MutationRef<UpsertUserByIdData, UpsertUserByIdVariables>;
}
export const upsertUserByIdRef: UpsertUserByIdRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
upsertUserById(dc: DataConnect, vars: UpsertUserByIdVariables): MutationPromise<UpsertUserByIdData, UpsertUserByIdVariables>;

interface UpsertUserByIdRef {
  ...
  (dc: DataConnect, vars: UpsertUserByIdVariables): MutationRef<UpsertUserByIdData, UpsertUserByIdVariables>;
}
export const upsertUserByIdRef: UpsertUserByIdRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the upsertUserByIdRef:
```typescript
const name = upsertUserByIdRef.operationName;
console.log(name);
```

### Variables
The `UpsertUserById` mutation requires an argument of type `UpsertUserByIdVariables`, which is defined in [dataconnect/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface UpsertUserByIdVariables {
  id: UUIDString;
  phone: string;
  name: string;
  role: UserRole;
  firebaseUid?: string | null;
  passwordHash?: string | null;
}
```
### Return Type
Recall that executing the `UpsertUserById` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `UpsertUserByIdData`, which is defined in [dataconnect/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface UpsertUserByIdData {
  user_upsert: User_Key;
}
```
### Using `UpsertUserById`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, upsertUserById, UpsertUserByIdVariables } from '@tiennuoc/dataconnect';

// The `UpsertUserById` mutation requires an argument of type `UpsertUserByIdVariables`:
const upsertUserByIdVars: UpsertUserByIdVariables = {
  id: ..., 
  phone: ..., 
  name: ..., 
  role: ..., 
  firebaseUid: ..., // optional
  passwordHash: ..., // optional
};

// Call the `upsertUserById()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await upsertUserById(upsertUserByIdVars);
// Variables can be defined inline as well.
const { data } = await upsertUserById({ id: ..., phone: ..., name: ..., role: ..., firebaseUid: ..., passwordHash: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await upsertUserById(dataConnect, upsertUserByIdVars);

console.log(data.user_upsert);

// Or, you can use the `Promise` API.
upsertUserById(upsertUserByIdVars).then((response) => {
  const data = response.data;
  console.log(data.user_upsert);
});
```

### Using `UpsertUserById`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, upsertUserByIdRef, UpsertUserByIdVariables } from '@tiennuoc/dataconnect';

// The `UpsertUserById` mutation requires an argument of type `UpsertUserByIdVariables`:
const upsertUserByIdVars: UpsertUserByIdVariables = {
  id: ..., 
  phone: ..., 
  name: ..., 
  role: ..., 
  firebaseUid: ..., // optional
  passwordHash: ..., // optional
};

// Call the `upsertUserByIdRef()` function to get a reference to the mutation.
const ref = upsertUserByIdRef(upsertUserByIdVars);
// Variables can be defined inline as well.
const ref = upsertUserByIdRef({ id: ..., phone: ..., name: ..., role: ..., firebaseUid: ..., passwordHash: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = upsertUserByIdRef(dataConnect, upsertUserByIdVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.user_upsert);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.user_upsert);
});
```

## UpdateUserFirebaseUid
You can execute the `UpdateUserFirebaseUid` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect/index.d.ts](./index.d.ts):
```typescript
updateUserFirebaseUid(vars: UpdateUserFirebaseUidVariables): MutationPromise<UpdateUserFirebaseUidData, UpdateUserFirebaseUidVariables>;

interface UpdateUserFirebaseUidRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: UpdateUserFirebaseUidVariables): MutationRef<UpdateUserFirebaseUidData, UpdateUserFirebaseUidVariables>;
}
export const updateUserFirebaseUidRef: UpdateUserFirebaseUidRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
updateUserFirebaseUid(dc: DataConnect, vars: UpdateUserFirebaseUidVariables): MutationPromise<UpdateUserFirebaseUidData, UpdateUserFirebaseUidVariables>;

interface UpdateUserFirebaseUidRef {
  ...
  (dc: DataConnect, vars: UpdateUserFirebaseUidVariables): MutationRef<UpdateUserFirebaseUidData, UpdateUserFirebaseUidVariables>;
}
export const updateUserFirebaseUidRef: UpdateUserFirebaseUidRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the updateUserFirebaseUidRef:
```typescript
const name = updateUserFirebaseUidRef.operationName;
console.log(name);
```

### Variables
The `UpdateUserFirebaseUid` mutation requires an argument of type `UpdateUserFirebaseUidVariables`, which is defined in [dataconnect/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface UpdateUserFirebaseUidVariables {
  id: UUIDString;
  firebaseUid: string;
}
```
### Return Type
Recall that executing the `UpdateUserFirebaseUid` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `UpdateUserFirebaseUidData`, which is defined in [dataconnect/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface UpdateUserFirebaseUidData {
  user_update?: User_Key | null;
}
```
### Using `UpdateUserFirebaseUid`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, updateUserFirebaseUid, UpdateUserFirebaseUidVariables } from '@tiennuoc/dataconnect';

// The `UpdateUserFirebaseUid` mutation requires an argument of type `UpdateUserFirebaseUidVariables`:
const updateUserFirebaseUidVars: UpdateUserFirebaseUidVariables = {
  id: ..., 
  firebaseUid: ..., 
};

// Call the `updateUserFirebaseUid()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await updateUserFirebaseUid(updateUserFirebaseUidVars);
// Variables can be defined inline as well.
const { data } = await updateUserFirebaseUid({ id: ..., firebaseUid: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await updateUserFirebaseUid(dataConnect, updateUserFirebaseUidVars);

console.log(data.user_update);

// Or, you can use the `Promise` API.
updateUserFirebaseUid(updateUserFirebaseUidVars).then((response) => {
  const data = response.data;
  console.log(data.user_update);
});
```

### Using `UpdateUserFirebaseUid`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, updateUserFirebaseUidRef, UpdateUserFirebaseUidVariables } from '@tiennuoc/dataconnect';

// The `UpdateUserFirebaseUid` mutation requires an argument of type `UpdateUserFirebaseUidVariables`:
const updateUserFirebaseUidVars: UpdateUserFirebaseUidVariables = {
  id: ..., 
  firebaseUid: ..., 
};

// Call the `updateUserFirebaseUidRef()` function to get a reference to the mutation.
const ref = updateUserFirebaseUidRef(updateUserFirebaseUidVars);
// Variables can be defined inline as well.
const ref = updateUserFirebaseUidRef({ id: ..., firebaseUid: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = updateUserFirebaseUidRef(dataConnect, updateUserFirebaseUidVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.user_update);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.user_update);
});
```

## UpdateUserPasswordHash
You can execute the `UpdateUserPasswordHash` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect/index.d.ts](./index.d.ts):
```typescript
updateUserPasswordHash(vars: UpdateUserPasswordHashVariables): MutationPromise<UpdateUserPasswordHashData, UpdateUserPasswordHashVariables>;

interface UpdateUserPasswordHashRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: UpdateUserPasswordHashVariables): MutationRef<UpdateUserPasswordHashData, UpdateUserPasswordHashVariables>;
}
export const updateUserPasswordHashRef: UpdateUserPasswordHashRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
updateUserPasswordHash(dc: DataConnect, vars: UpdateUserPasswordHashVariables): MutationPromise<UpdateUserPasswordHashData, UpdateUserPasswordHashVariables>;

interface UpdateUserPasswordHashRef {
  ...
  (dc: DataConnect, vars: UpdateUserPasswordHashVariables): MutationRef<UpdateUserPasswordHashData, UpdateUserPasswordHashVariables>;
}
export const updateUserPasswordHashRef: UpdateUserPasswordHashRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the updateUserPasswordHashRef:
```typescript
const name = updateUserPasswordHashRef.operationName;
console.log(name);
```

### Variables
The `UpdateUserPasswordHash` mutation requires an argument of type `UpdateUserPasswordHashVariables`, which is defined in [dataconnect/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface UpdateUserPasswordHashVariables {
  id: UUIDString;
  passwordHash: string;
}
```
### Return Type
Recall that executing the `UpdateUserPasswordHash` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `UpdateUserPasswordHashData`, which is defined in [dataconnect/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface UpdateUserPasswordHashData {
  user_update?: User_Key | null;
}
```
### Using `UpdateUserPasswordHash`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, updateUserPasswordHash, UpdateUserPasswordHashVariables } from '@tiennuoc/dataconnect';

// The `UpdateUserPasswordHash` mutation requires an argument of type `UpdateUserPasswordHashVariables`:
const updateUserPasswordHashVars: UpdateUserPasswordHashVariables = {
  id: ..., 
  passwordHash: ..., 
};

// Call the `updateUserPasswordHash()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await updateUserPasswordHash(updateUserPasswordHashVars);
// Variables can be defined inline as well.
const { data } = await updateUserPasswordHash({ id: ..., passwordHash: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await updateUserPasswordHash(dataConnect, updateUserPasswordHashVars);

console.log(data.user_update);

// Or, you can use the `Promise` API.
updateUserPasswordHash(updateUserPasswordHashVars).then((response) => {
  const data = response.data;
  console.log(data.user_update);
});
```

### Using `UpdateUserPasswordHash`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, updateUserPasswordHashRef, UpdateUserPasswordHashVariables } from '@tiennuoc/dataconnect';

// The `UpdateUserPasswordHash` mutation requires an argument of type `UpdateUserPasswordHashVariables`:
const updateUserPasswordHashVars: UpdateUserPasswordHashVariables = {
  id: ..., 
  passwordHash: ..., 
};

// Call the `updateUserPasswordHashRef()` function to get a reference to the mutation.
const ref = updateUserPasswordHashRef(updateUserPasswordHashVars);
// Variables can be defined inline as well.
const ref = updateUserPasswordHashRef({ id: ..., passwordHash: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = updateUserPasswordHashRef(dataConnect, updateUserPasswordHashVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.user_update);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.user_update);
});
```

## CreateAuditLog
You can execute the `CreateAuditLog` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect/index.d.ts](./index.d.ts):
```typescript
createAuditLog(vars: CreateAuditLogVariables): MutationPromise<CreateAuditLogData, CreateAuditLogVariables>;

interface CreateAuditLogRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: CreateAuditLogVariables): MutationRef<CreateAuditLogData, CreateAuditLogVariables>;
}
export const createAuditLogRef: CreateAuditLogRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
createAuditLog(dc: DataConnect, vars: CreateAuditLogVariables): MutationPromise<CreateAuditLogData, CreateAuditLogVariables>;

interface CreateAuditLogRef {
  ...
  (dc: DataConnect, vars: CreateAuditLogVariables): MutationRef<CreateAuditLogData, CreateAuditLogVariables>;
}
export const createAuditLogRef: CreateAuditLogRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the createAuditLogRef:
```typescript
const name = createAuditLogRef.operationName;
console.log(name);
```

### Variables
The `CreateAuditLog` mutation requires an argument of type `CreateAuditLogVariables`, which is defined in [dataconnect/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface CreateAuditLogVariables {
  actorId?: UUIDString | null;
  action: string;
  entity: string;
  entityId?: string | null;
  metadata?: string | null;
}
```
### Return Type
Recall that executing the `CreateAuditLog` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `CreateAuditLogData`, which is defined in [dataconnect/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface CreateAuditLogData {
  auditLog_insert: AuditLog_Key;
}
```
### Using `CreateAuditLog`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, createAuditLog, CreateAuditLogVariables } from '@tiennuoc/dataconnect';

// The `CreateAuditLog` mutation requires an argument of type `CreateAuditLogVariables`:
const createAuditLogVars: CreateAuditLogVariables = {
  actorId: ..., // optional
  action: ..., 
  entity: ..., 
  entityId: ..., // optional
  metadata: ..., // optional
};

// Call the `createAuditLog()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await createAuditLog(createAuditLogVars);
// Variables can be defined inline as well.
const { data } = await createAuditLog({ actorId: ..., action: ..., entity: ..., entityId: ..., metadata: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await createAuditLog(dataConnect, createAuditLogVars);

console.log(data.auditLog_insert);

// Or, you can use the `Promise` API.
createAuditLog(createAuditLogVars).then((response) => {
  const data = response.data;
  console.log(data.auditLog_insert);
});
```

### Using `CreateAuditLog`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, createAuditLogRef, CreateAuditLogVariables } from '@tiennuoc/dataconnect';

// The `CreateAuditLog` mutation requires an argument of type `CreateAuditLogVariables`:
const createAuditLogVars: CreateAuditLogVariables = {
  actorId: ..., // optional
  action: ..., 
  entity: ..., 
  entityId: ..., // optional
  metadata: ..., // optional
};

// Call the `createAuditLogRef()` function to get a reference to the mutation.
const ref = createAuditLogRef(createAuditLogVars);
// Variables can be defined inline as well.
const ref = createAuditLogRef({ actorId: ..., action: ..., entity: ..., entityId: ..., metadata: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = createAuditLogRef(dataConnect, createAuditLogVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.auditLog_insert);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.auditLog_insert);
});
```

