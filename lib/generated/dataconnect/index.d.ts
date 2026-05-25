import { ConnectorConfig, DataConnect, QueryRef, QueryPromise, ExecuteQueryOptions, MutationRef, MutationPromise } from 'firebase/data-connect';

export const connectorConfig: ConnectorConfig;

export type TimestampString = string;
export type UUIDString = string;
export type Int64String = string;
export type DateString = string;


export enum UserRole {
  RESIDENT = "RESIDENT",
  ADMIN = "ADMIN",
};



export interface AuditLog_Key {
  id: UUIDString;
  __typename?: 'AuditLog_Key';
}

export interface BillingPeriod_Key {
  id: UUIDString;
  __typename?: 'BillingPeriod_Key';
}

export interface CollectionRoute_Key {
  id: UUIDString;
  __typename?: 'CollectionRoute_Key';
}

export interface CreateAuditLogData {
  auditLog_insert: AuditLog_Key;
}

export interface CreateAuditLogVariables {
  actorId?: UUIDString | null;
  action: string;
  entity: string;
  entityId?: string | null;
  metadata?: string | null;
}

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

export interface GetUserByFirebaseUidVariables {
  uid: string;
}

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

export interface GetUserByIdVariables {
  id: UUIDString;
}

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

export interface GetUserByPhoneVariables {
  phone: string;
}

export interface Household_Key {
  id: UUIDString;
  __typename?: 'Household_Key';
}

export interface Invoice_Key {
  id: UUIDString;
  __typename?: 'Invoice_Key';
}

export interface ListUsersData {
  users: ({
    id: UUIDString;
    phone: string;
    name: string;
    role: UserRole;
    firebaseUid?: string | null;
  } & User_Key)[];
}

export interface ListUsersVariables {
  limit?: number | null;
}

export interface MeterReading_Key {
  id: UUIDString;
  __typename?: 'MeterReading_Key';
}

export interface Notification_Key {
  id: UUIDString;
  __typename?: 'Notification_Key';
}

export interface Payment_Key {
  id: UUIDString;
  __typename?: 'Payment_Key';
}

export interface PriceGroup_Key {
  id: UUIDString;
  __typename?: 'PriceGroup_Key';
}

export interface SystemSettings_Key {
  id: string;
  __typename?: 'SystemSettings_Key';
}

export interface UpdateUserFirebaseUidData {
  user_update?: User_Key | null;
}

export interface UpdateUserFirebaseUidVariables {
  id: UUIDString;
  firebaseUid: string;
}

export interface UpdateUserPasswordHashData {
  user_update?: User_Key | null;
}

export interface UpdateUserPasswordHashVariables {
  id: UUIDString;
  passwordHash: string;
}

export interface UpsertUserByIdData {
  user_upsert: User_Key;
}

export interface UpsertUserByIdVariables {
  id: UUIDString;
  phone: string;
  name: string;
  role: UserRole;
  firebaseUid?: string | null;
  passwordHash?: string | null;
}

export interface User_Key {
  id: UUIDString;
  __typename?: 'User_Key';
}

interface UpsertUserByIdRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: UpsertUserByIdVariables): MutationRef<UpsertUserByIdData, UpsertUserByIdVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: UpsertUserByIdVariables): MutationRef<UpsertUserByIdData, UpsertUserByIdVariables>;
  operationName: string;
}
export const upsertUserByIdRef: UpsertUserByIdRef;

export function upsertUserById(vars: UpsertUserByIdVariables): MutationPromise<UpsertUserByIdData, UpsertUserByIdVariables>;
export function upsertUserById(dc: DataConnect, vars: UpsertUserByIdVariables): MutationPromise<UpsertUserByIdData, UpsertUserByIdVariables>;

interface UpdateUserFirebaseUidRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: UpdateUserFirebaseUidVariables): MutationRef<UpdateUserFirebaseUidData, UpdateUserFirebaseUidVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: UpdateUserFirebaseUidVariables): MutationRef<UpdateUserFirebaseUidData, UpdateUserFirebaseUidVariables>;
  operationName: string;
}
export const updateUserFirebaseUidRef: UpdateUserFirebaseUidRef;

export function updateUserFirebaseUid(vars: UpdateUserFirebaseUidVariables): MutationPromise<UpdateUserFirebaseUidData, UpdateUserFirebaseUidVariables>;
export function updateUserFirebaseUid(dc: DataConnect, vars: UpdateUserFirebaseUidVariables): MutationPromise<UpdateUserFirebaseUidData, UpdateUserFirebaseUidVariables>;

interface UpdateUserPasswordHashRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: UpdateUserPasswordHashVariables): MutationRef<UpdateUserPasswordHashData, UpdateUserPasswordHashVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: UpdateUserPasswordHashVariables): MutationRef<UpdateUserPasswordHashData, UpdateUserPasswordHashVariables>;
  operationName: string;
}
export const updateUserPasswordHashRef: UpdateUserPasswordHashRef;

export function updateUserPasswordHash(vars: UpdateUserPasswordHashVariables): MutationPromise<UpdateUserPasswordHashData, UpdateUserPasswordHashVariables>;
export function updateUserPasswordHash(dc: DataConnect, vars: UpdateUserPasswordHashVariables): MutationPromise<UpdateUserPasswordHashData, UpdateUserPasswordHashVariables>;

interface CreateAuditLogRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: CreateAuditLogVariables): MutationRef<CreateAuditLogData, CreateAuditLogVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: CreateAuditLogVariables): MutationRef<CreateAuditLogData, CreateAuditLogVariables>;
  operationName: string;
}
export const createAuditLogRef: CreateAuditLogRef;

export function createAuditLog(vars: CreateAuditLogVariables): MutationPromise<CreateAuditLogData, CreateAuditLogVariables>;
export function createAuditLog(dc: DataConnect, vars: CreateAuditLogVariables): MutationPromise<CreateAuditLogData, CreateAuditLogVariables>;

interface GetUserByPhoneRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: GetUserByPhoneVariables): QueryRef<GetUserByPhoneData, GetUserByPhoneVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: GetUserByPhoneVariables): QueryRef<GetUserByPhoneData, GetUserByPhoneVariables>;
  operationName: string;
}
export const getUserByPhoneRef: GetUserByPhoneRef;

export function getUserByPhone(vars: GetUserByPhoneVariables, options?: ExecuteQueryOptions): QueryPromise<GetUserByPhoneData, GetUserByPhoneVariables>;
export function getUserByPhone(dc: DataConnect, vars: GetUserByPhoneVariables, options?: ExecuteQueryOptions): QueryPromise<GetUserByPhoneData, GetUserByPhoneVariables>;

interface GetUserByIdRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: GetUserByIdVariables): QueryRef<GetUserByIdData, GetUserByIdVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: GetUserByIdVariables): QueryRef<GetUserByIdData, GetUserByIdVariables>;
  operationName: string;
}
export const getUserByIdRef: GetUserByIdRef;

export function getUserById(vars: GetUserByIdVariables, options?: ExecuteQueryOptions): QueryPromise<GetUserByIdData, GetUserByIdVariables>;
export function getUserById(dc: DataConnect, vars: GetUserByIdVariables, options?: ExecuteQueryOptions): QueryPromise<GetUserByIdData, GetUserByIdVariables>;

interface GetUserByFirebaseUidRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: GetUserByFirebaseUidVariables): QueryRef<GetUserByFirebaseUidData, GetUserByFirebaseUidVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: GetUserByFirebaseUidVariables): QueryRef<GetUserByFirebaseUidData, GetUserByFirebaseUidVariables>;
  operationName: string;
}
export const getUserByFirebaseUidRef: GetUserByFirebaseUidRef;

export function getUserByFirebaseUid(vars: GetUserByFirebaseUidVariables, options?: ExecuteQueryOptions): QueryPromise<GetUserByFirebaseUidData, GetUserByFirebaseUidVariables>;
export function getUserByFirebaseUid(dc: DataConnect, vars: GetUserByFirebaseUidVariables, options?: ExecuteQueryOptions): QueryPromise<GetUserByFirebaseUidData, GetUserByFirebaseUidVariables>;

interface GetMeRef {
  /* Allow users to create refs without passing in DataConnect */
  (): QueryRef<GetMeData, undefined>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect): QueryRef<GetMeData, undefined>;
  operationName: string;
}
export const getMeRef: GetMeRef;

export function getMe(options?: ExecuteQueryOptions): QueryPromise<GetMeData, undefined>;
export function getMe(dc: DataConnect, options?: ExecuteQueryOptions): QueryPromise<GetMeData, undefined>;

interface ListUsersRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars?: ListUsersVariables): QueryRef<ListUsersData, ListUsersVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars?: ListUsersVariables): QueryRef<ListUsersData, ListUsersVariables>;
  operationName: string;
}
export const listUsersRef: ListUsersRef;

export function listUsers(vars?: ListUsersVariables, options?: ExecuteQueryOptions): QueryPromise<ListUsersData, ListUsersVariables>;
export function listUsers(dc: DataConnect, vars?: ListUsersVariables, options?: ExecuteQueryOptions): QueryPromise<ListUsersData, ListUsersVariables>;

