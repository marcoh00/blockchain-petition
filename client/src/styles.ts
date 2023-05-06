import { css, unsafeCSS } from 'lit';
import fa from "@fortawesome/fontawesome-svg-core/styles.css";
export const faStyle = unsafeCSS(fa);
console.log(fa, faStyle);
//export const faStyle = css``;

export const basicFlex = css`
:host {
    display: flex;
    gap: 1em;
}
`;

export const topDownFlex = css`
:host {
    flex-flow: column wrap;
    justify-content: flex-start;
    align-items: stretch;
    border-collapse: separate;
}
`;

export const leftRightFlex = css`
:host {
    flex-flow: row nowrap;
    justify-content: center;
    align-items: center;
}
`;

export const buttonMixin = css`
    button {
        border: none;
        padding: 0.5rem;
        text-align: center;
        margin: 0 0.1rem 0.2rem 0.2rem;
        background-color: #33A1FD;
        color: #faffdb;
        font-size: 1em;
        border-radius: 4px;
        cursor: pointer;
    }

    .disabled {
        background-color: #D4EBFF;
        color: #929AA0;
        cursor: default;
    }

    .mediumbtn {
        font-size: 2.0em;
    }

    .smallbtn {
        font-size: 1.0em;
    }

    .hugebtn {
        padding: 0.5rem 2rem;
        background-color: #FDCA40;
        color: #000000;
        font-size: 2.5em;
    }
`;

/*

Colors
397565
3a7879
3b687e
3b5682
3c4187


b0cab4
8999c9
8f52a3
fae190
ce96df

f94144
f3722c
f8961e
f9c74f
90be6d
43aa8b
577590
*/

export const colorfulBar = css`
:host {
    background-image: linear-gradient(#57656A, #31393C);
}
`;