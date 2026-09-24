const fs = require("fs");

console.log("1. Program Start");

setTimeout(() => {
    console.log("2. setTimeout");

    Promise.resolve().then(() => {
        console.log("3. Promise inside setTimeout");
    });

    process.nextTick(() => {
        console.log("4. nextTick inside setTimeout");
    });

}, 0);


setImmediate(() => {
    console.log("5. setImmediate");

    Promise.resolve().then(() => {
        console.log("6. Promise inside setImmediate");
    });
});


process.nextTick(() => {
    console.log("7. process.nextTick");

    process.nextTick(() => {
        console.log("8. Nested nextTick");
    });

    Promise.resolve().then(() => {
        console.log("9. Promise inside nextTick");
    });
});


Promise.resolve().then(() => {
    console.log("10. Promise 1");

    process.nextTick(() => {
        console.log("11. nextTick inside Promise");
    });

    Promise.resolve().then(() => {
        console.log("12. Promise 2");
    });
});


fs.readFile("./file.txt", "utf8", (err, data) => {

    console.log("13. File Reading Callback");

    process.nextTick(() => {
        console.log("14. nextTick inside File Callback");
    });

    Promise.resolve().then(() => {
        console.log("15. Promise inside File Callback");
    });

    setTimeout(() => {
        console.log("16. Timer inside File Callback");
    }, 0);

    setImmediate(() => {
        console.log("17. Immediate inside File Callback");
    });
});


async function fetchData() {

    console.log("18. fetchData Start");

    await Promise.resolve();

    console.log("19. After await");

    process.nextTick(() => {
        console.log("20. nextTick after await");
    });

    Promise.resolve().then(() => {
        console.log("21. Promise after await");
    });
}


fetchData();


console.log("22. Program End");