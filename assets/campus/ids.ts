import { AssetGuid } from '@forgeax/engine/pack/guid';
import { definePackageId, type PackageId } from '@forgeax/engine/pack/source';
export const GEOMETRY = definePackageId('c8706ab9-c08d-4ab5-bd4d-1eb94f457b58');
export const DAYLIGHT = definePackageId('26ae06e0-3848-4c92-9d8a-95d28f94faeb');
export const SCENE = definePackageId('0cc53e0e-26b3-4c19-b92e-dfbec29e54d8');
export const CAMPUS = definePackageId('b24935a2-2e96-4c5c-82f5-2bd0953ddf6b');
export const FRONTEND = definePackageId('560c60a1-83ac-449d-8b73-8e13cfc39fa3');
export const SCENE_KEY = 'scene/beiyang-campus';
export const guid = (pack: PackageId, key: string) => AssetGuid.format(AssetGuid.derive(pack, key));
