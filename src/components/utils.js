let open = window.require("open");

export const compareVersions = (a, b, ignoreDevVersions=false) => {
    const hierarchy = ["dev", "alpha", "beta", "rc"];
    const regex = new RegExp(`(\\d+)(\\.\\d+)+((-)([(` + hierarchy.join(")(") + `)]+)(\\.\d+)*)?`, 'gi');
    if (!a.match(regex) || !b.match(regex)) return undefined;
    if (a === b) return 0;

    const softParseInt = (int) => isNaN(parseInt(int)) ? int : parseInt(int);
    const splitVersionArray = (arr) => arr.split('-').map(value => value.split('.'))
        .map((value) => value.map(value => softParseInt(value)));
    const arrCmp = (arr1, arr2) => {
        const modArr1 = arr1.concat(Array(Math.max(0, arr2.length - arr1.length)).fill(0));
        const modArr2 = arr2.concat(Array(Math.max(0, arr1.length - arr2.length)).fill(0));
        return modArr1.map((val, index) =>
            (parseInt(val) - parseInt(modArr2[index]))
        ).find(value => value !== 0) || 0;
    };

    const ver1 = (ignoreDevVersions) ? [splitVersionArray(a)[0]] : splitVersionArray(a);
    const ver2 = (ignoreDevVersions) ? [splitVersionArray(b)[0]] : splitVersionArray(b);

    const baseVer = arrCmp(ver1[0], ver2[0]);

    if (baseVer === 0 && (ver1.length > 1 || ver2.length > 1)){
        if (ver1.length !== ver2.length) return (ver1.length < ver2.length) ? 1 : -1;
        else {
            const subVerPhase = (hierarchy.indexOf(ver1[1][0]) - hierarchy.indexOf(ver2[1][0]));
            if (subVerPhase !== 0) return subVerPhase;
            else {
                ver1[1].shift();
                ver2[1].shift();
                return arrCmp(ver1[1], ver2[1]);
            }
        }
    }
    return baseVer;
};

export const getNewVersion = () => {
    const newVersionURL = "https://github.com/Tornith/CHSplit/releases/latest";
    openLink(newVersionURL);
};

export const openLink = (link) => {
    open(link);
};

export const isDictEmpty = (dict) => {
    return Object.keys(dict).length === 0;
};