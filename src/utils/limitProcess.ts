export async function runWithConcurrency<T>(
    tasks: (() => Promise<T>)[],
    concurrency = 5
): Promise<T[]> {
    const results: T[] = [];
    const executing = new Set<Promise<void>>();

    for (const task of tasks) {
        const p = task().then((res) => {
            results.push(res);
        });

        executing.add(p);

        if (executing.size >= concurrency) {
            await Promise.race(executing);
        }

        p.finally(() => executing.delete(p));
    }

    await Promise.all(executing);
    return results;
}
