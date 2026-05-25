# Basic Usage

Always prioritize using a supported framework over using the generated SDK
directly. Supported frameworks simplify the developer experience and help ensure
best practices are followed.





## Advanced Usage
If a user is not using a supported framework, they can use the generated SDK directly.

Here's an example of how to use it with the first 5 operations:

```js
import { upsertUserById, updateUserFirebaseUid, updateUserPasswordHash, createAuditLog, getUserByPhone, getUserById, getUserByFirebaseUid, getMe, listUsers } from '@tiennuoc/dataconnect';


// Operation UpsertUserById:  For variables, look at type UpsertUserByIdVars in ../index.d.ts
const { data } = await UpsertUserById(dataConnect, upsertUserByIdVars);

// Operation UpdateUserFirebaseUid:  For variables, look at type UpdateUserFirebaseUidVars in ../index.d.ts
const { data } = await UpdateUserFirebaseUid(dataConnect, updateUserFirebaseUidVars);

// Operation UpdateUserPasswordHash:  For variables, look at type UpdateUserPasswordHashVars in ../index.d.ts
const { data } = await UpdateUserPasswordHash(dataConnect, updateUserPasswordHashVars);

// Operation CreateAuditLog:  For variables, look at type CreateAuditLogVars in ../index.d.ts
const { data } = await CreateAuditLog(dataConnect, createAuditLogVars);

// Operation GetUserByPhone:  For variables, look at type GetUserByPhoneVars in ../index.d.ts
const { data } = await GetUserByPhone(dataConnect, getUserByPhoneVars);

// Operation GetUserById:  For variables, look at type GetUserByIdVars in ../index.d.ts
const { data } = await GetUserById(dataConnect, getUserByIdVars);

// Operation GetUserByFirebaseUid:  For variables, look at type GetUserByFirebaseUidVars in ../index.d.ts
const { data } = await GetUserByFirebaseUid(dataConnect, getUserByFirebaseUidVars);

// Operation GetMe: 
const { data } = await GetMe(dataConnect);

// Operation ListUsers:  For variables, look at type ListUsersVars in ../index.d.ts
const { data } = await ListUsers(dataConnect, listUsersVars);


```