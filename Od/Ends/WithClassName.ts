namespace Od {
    export const withClassName =
    (name: string, props: Od.IProps): Od.IProps => {
        props = props || {};
        const className = props["className"] || "";
	name = " " + name + " ";
	const nameIsAbsent = className.indexOf(name) === -1;
	if (nameIsAbsent) props["className"] = name + className;
        return props;
    };
}