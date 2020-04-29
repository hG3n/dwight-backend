export const nullOrUndefined = (element: any) => {
    return element === undefined || element === null;
};

export const getMsg = (success: boolean, message: string, data: any = null) => {
    return {
        success,
        message,
        data
    }
};
