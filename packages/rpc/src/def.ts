import { IRpcRoute } from "./typing/handler.js"
import { RpcResponseFactory, RpcResponse } from "./response.js"
import { StatusCode } from "./typing/status-code.js"
import { mergePath } from "./utils/request.js"
import { IsAny, PrefixWith$, Simplify, UnionToIntersection } from "./typing/utils.js"
import { ResponseFormat, Input, BlankInput, Schema, BlankSchema, MergeSchemaPath, MergePath } from "./typing/rpc.js"

export type MiddlewareNode<
  _TPath extends string = string,
  _TInput extends Input = {}
> = () => void

export type TerminalNode<
  _TPath extends string = any,
  _TInput extends Input = BlankInput,
  TRes extends RpcResponse<any> = any
> = (res: RpcResponseFactory) => TRes

export type IRpcNode<
  TPath extends string = any,
  TInput extends Input = BlankInput,
  TRes extends RpcResponse<any> = any
> = MiddlewareNode<TPath, TInput> | TerminalNode<TPath, TInput, TRes>

export const rpc = <
  TSchema extends Schema = BlankSchema,
  TBasePath extends string = "/",
>() => new RpcNode<TSchema, TBasePath>()
/**
 * Interface representing a router.
 *
 * @template T - The type of the handler.
 */
export interface Router<T> {
  /**
   * The name of the router.
   */
  name: string

  /**
   * Adds a route to the router.
   *
   * @param method - The HTTP method (e.g., 'get', 'post').
   * @param path - The path for the route.
   * @param handler - The handler for the route.
   */
  add(method: string, path: string, handler: T): void
}
export interface RouterRoute {
  path: string
  method: string
  handler: IRpcNode
}
export class RpcNode<
  TSchema extends Schema = BlankSchema,
  TBasePath extends string = "/",
> {
  private _basePath: string = '/'
  routes: RouterRoute[] = []

  get!: IRpcRoute<'get', TSchema, TBasePath>
  post!: IRpcRoute<'post', TSchema, TBasePath>
  put!: IRpcRoute<'put', TSchema, TBasePath>
  delete!: IRpcRoute<'delete', TSchema, TBasePath>
  options!: IRpcRoute<'options', TSchema, TBasePath>
  patch!: IRpcRoute<'patch', TSchema, TBasePath>

  route<
    TSubPath extends string,
    TSubSchema extends Schema,
    TSubBasePath extends string
  >(
    path: TSubPath,
    app: RpcNode<TSubSchema, TSubBasePath>
  ): RpcNode<MergeSchemaPath<TSubSchema, MergePath<TBasePath, TSubPath>> | TSchema, TBasePath> {
    const subApp = this.basePath(path)
    app.routes.map((r) => {
      subApp.addRoute(r.method, r.path, r.handler)
    })
    return this
  }

  private addRoute(method: string, path: string, handler: IRpcNode) {
    method = method.toUpperCase()
    path = mergePath(this._basePath, path)
    const r: RouterRoute = { path, method, handler }
    this.routes.push(r)
  }

  /**
 * `.basePath()` allows base paths to be specified.
 *
 * @see {@link https://hono.dev/docs/api/routing#base-path}
 *
 * @param {string} path - base Path
 * @returns {Hono} changed Hono instance
 *
 * @example
 * ```ts
 * const api = new Hono().basePath('/api')
 * ```
 */
  basePath<TSubPath extends string>(path: TSubPath): RpcNode<TSchema, MergePath<TBasePath, TSubPath>> {
    const subApp = this.clone()
    subApp._basePath = mergePath(this._basePath, path)
    return subApp
  }

  private clone(): RpcNode<TSchema, TBasePath> {
    const clone = new RpcNode<TSchema, TBasePath>()
    clone.routes = this.routes
    return clone
  }
}

type ParamKey<Component> = Component extends `:${infer NameWithPattern}`
  ? NameWithPattern extends `${infer Name}{${infer Rest}`
  ? Rest extends `${infer _Pattern}?`
  ? `${Name}?`
  : Name
  : NameWithPattern
  : never

export type ParamKeys<TPath> = TPath extends `${infer Component}/${infer Rest}`
  ? ParamKey<Component> | ParamKeys<Rest>
  : ParamKey<TPath>

export type ParamKeyToRecord<T extends string> = T extends `${infer R}?`
  ? Record<R, string | undefined>
  : { [K in T]: string }

export type AddParam<TInput, TPath extends string> = ParamKeys<TPath> extends never
  ? TInput
  : TInput extends { param: infer _ }
  ? TInput
  : TInput & { param: UnionToIntersection<ParamKeyToRecord<ParamKeys<TPath>>> }

export type ExtractInput<TInput extends Input | Input['in']> = TInput extends Input
  ? unknown extends TInput['in']
  ? {}
  : TInput['in']
  : TInput

export type ToSchema<
  TMethod extends string,
  TPath extends string,
  TInput extends Input | Input['in'],
  RorO // Response or Output
> = Simplify<{
  [K in TPath]: {
    [K2 in TMethod as PrefixWith$<K2>]: Simplify<
      {
        input: AddParam<ExtractInput<TInput>, TPath>
      } & (IsAny<RorO> extends true
        ? {
          output: {}
          outputFormat: ResponseFormat
          status: StatusCode
        }
        : RorO extends RpcResponse<infer T, infer U, infer F>
        ? {
          output: unknown extends T ? {} : T
          outputFormat: TInput extends { outputFormat: string } ? TInput['outputFormat'] : F
          status: U
        }
        : {
          output: unknown extends RorO ? {} : RorO
          outputFormat: unknown extends RorO
          ? 'json'
          : TInput extends { outputFormat: string }
          ? TInput['outputFormat']
          : 'json'
          status: StatusCode
        })
    >
  }
}>
