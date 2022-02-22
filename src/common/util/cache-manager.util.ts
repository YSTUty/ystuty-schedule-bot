import * as Fs from 'fs-extra';
import * as Path from 'path';
import * as lodash from 'lodash';

import { CACHE_PATH } from '@my-environment';
import { md5 } from '@my-common';

export type CacheData<T = any> = {
    time: number;
    ttl: number;
    data: T;
    source: string;
};

export type PathType = string | [string, string];

export class CacheManager {
    private cache: Record<string, CacheData> = {};

    constructor(public readonly path = CACHE_PATH) {
        Fs.ensureDir(this.path).then();
    }

    private async parseFilePath(path: PathType, ensure = true) {
        if (Array.isArray(path)) {
            if (path.length !== 2) {
                console.error('[cacheman] wrong file! [dir, file]');
                return null;
            }
            if (ensure) {
                await Fs.ensureDir(Path.resolve(this.path, path[0]));
            }
            return [path[0], path[1]] as PathType;
        }
        return ['', path] as PathType;
    }

    public async create(file: PathType, data: any) {
        return this.update(file, data);
    }

    public async delete(file: PathType) {
        const arFile = await this.parseFilePath(file);
        if (!arFile) {
            return;
        }
        const [apath, afile] = arFile;

        const path = this.getPath(apath, afile);
        const name = this.genName(afile);
        try {
            delete this.cache[name];
            await Fs.unlink(path);
        } catch (err) {}
    }

    public async update(file: PathType, data: any, ttl: number = 36e4) {
        // console.log('\n\n-----', file, data);
        const arFile = await this.parseFilePath(file);
        if (!arFile) {
            return;
        }
        const [apath, afile] = arFile;

        const path = this.getPath(apath, afile);
        const name = this.genName(afile);

        const lastData = await this.readData(file, false);
        if (!Array.isArray(data)) {
            data = lodash.merge(lastData, data);
        }

        this.cache[name] = {
            time: Date.now(),
            ttl,
            data,
            source: afile,
        };

        await Fs.writeFile(path, JSON.stringify(this.cache[name], null, 2));
    }

    public async readData<T = any>(file: PathType, forceFile: boolean = false) {
        const { data } = (await this.read<T>(file, forceFile)) || {
            data: null,
        };
        return data;
    }

    public async read<T = any>(
        file: PathType,
        forceFile: boolean = false,
    ): Promise<CacheData<T> | null> {
        const arFile = await this.parseFilePath(file);
        if (!arFile) {
            return null;
        }
        const [apath, afile] = arFile;

        const name = this.genName(afile);
        if (!forceFile && this.cache[name]) {
            return this.cache[name];
        }

        const path = this.getPath(apath, afile);
        if (!Fs.existsSync(path)) {
            return null;
        }

        const str = await Fs.readFile(path, 'utf8');
        try {
            return JSON.parse(str);
        } catch (error) {
            console.error(error);
            return null;
        }
    }

    public isset(file: PathType, forceFile: boolean = false) {
        let apath = '';
        if (Array.isArray(file)) {
            if (file.length !== 2) {
                console.error('[cacheman] wrong file! [dir, file]');
                return null;
            }
            [apath, file] = file;
        }

        const path = this.getPath(apath, file);
        const name = this.genName(file);
        if (!forceFile && this.cache[name]) {
            return true;
        }
        return Fs.existsSync(path);
    }

    /**
     * Is cache file timeout
     */
    public async checkTimeout(file: PathType) {
        const arFile = await this.parseFilePath(file);
        if (!arFile) {
            return null;
        }

        const cache = await this.read(file);
        if (cache === null) {
            return null;
        }
        const { time, ttl } = cache;

        return Date.now() - (time || 0) > ttl;
    }

    public getPath(path: string, file: string) {
        return `${Path.resolve(this.path, path, this.genName(file))}.json`;
    }

    public genName(str: string) {
        return `${str.replace(/[^0-9А-яA-z-_]/gi, '').slice(0, 25)}.${md5(
            str.toLowerCase(),
        ).slice(-8)}`;
    }
}

export const cacheManager = new CacheManager();
