import { Children, cloneElement, isValidElement, type ReactNode } from 'react';

const isAsync = (fn: unknown) => typeof fn === 'function' && fn.constructor.name === 'AsyncFunction';

/**
 * Await every nested async server component in a tree, so `render()` sees what the server would send.
 * React's client renderer skips async components, which made "hidden" assertions pass vacuously.
 */
export async function resolveServerTree(node: ReactNode): Promise<ReactNode> {
  if (Array.isArray(node)) return Promise.all(node.map(resolveServerTree));
  if (!isValidElement(node)) return node;
  const props = node.props as { children?: ReactNode };
  if (isAsync(node.type)) {
    return resolveServerTree(await (node.type as (p: unknown) => Promise<ReactNode>)(props));
  }
  if (props.children === undefined) return node;
  const children = await Promise.all(Children.toArray(props.children).map(resolveServerTree));
  return cloneElement(node, undefined, ...children);
}
