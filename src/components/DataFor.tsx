import React, { Fragment, ReactElement, ReactNode } from 'react';

interface DataForProps {
    children: ((item: any, index: number) => ReactNode) | ReactElement;
    list?: any[];
    rowKey?: ((item: any, index: number) => string) | ((index: number) => string);
}

const DataFor = (props: DataForProps): JSX.Element => {
    const { children, list = [], rowKey } = props;

    return (
        <>
            {list.map((item, index) => {
                const key =
                    typeof rowKey === 'function' ? rowKey(item, index) : index.toString();

                return (
                    <Fragment key={key}>
                        {typeof children === 'function'
                            ? children(item, index)
                            : React.cloneElement(children as ReactElement, { item, index })}
                    </Fragment>
                );
            })}
        </>
    );
};

export default DataFor;
