import React, {ReactNode,Fragment} from 'react';

interface Props{
    children: ReactNode
}

interface WhetherProps extends Props{
    value: boolean;
}

const If: React.FC<Props> = ({ children }) => <>{children}</>;
const Else: React.FC<Props> = ({ children }) => <>{children}</>;

const Whether = ({ value, children }: WhetherProps):JSX.Element | null  => {
    const elements = React.Children.toArray(children);
    if (elements.length === 1) return value ? <Fragment>{elements[0]}</Fragment> : null;
    if (elements.length === 2) {
        const [ifEle, elseEle] = elements;
        if(React.isValidElement(ifEle) && ifEle.type === If && React.isValidElement(elseEle) && elseEle.type === Else){
            return value ? ifEle : elseEle
        }
        return <Fragment>{elements}</Fragment>
    }
    return null;
};

export default Whether;
export { If, Else };
