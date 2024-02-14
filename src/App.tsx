import React, {useCallback} from "react";

import {User as FirebaseUser} from "firebase/auth";
import {getDocFromServer, doc, getFirestore} from "firebase/firestore";
import {
    Authenticator,
    buildCollection, buildEntityCallbacks,
    buildProperty, EntityIdUpdateProps, FirebaseCMSApp, toKebabCase
} from "firecms";

import "typeface-rubik";
import "@fontsource/ibm-plex-mono";
interface GyanithEvent {
    name: string;
    type: string;
    imgs: string[]
    about: string;
    mdContent?: string;
    rules?: string;
    status: string;
    team: boolean;
    peopleHeader?: string;
    people?: PersonInfo[];
    fee?: number;
    contacts?: ContactInfo[];
}

interface ContactInfo {
    label: string;
    display: string;
    uri: string;
}

interface PersonInfo {
    name: string;
    img?: string;
    contacts?: ContactInfo[];
}

function asMap(...array: string[]): Record<string, string> {
    return array.reduce((acc, item) => {
        acc[item] = item;
        return acc;
    }, {} as Record<string, string>);
}

function contactURI(info: ContactInfo): ContactInfo {
    if (info.display.startsWith("http")) {
        info.uri = info.display;
    } else if (info.display.startsWith("+")) {
        if (!/^\+91-[0-9]{10}$/.test(info.display))
            throw Error("Invalid phone number: " + info.display + " (label: " + info.label + "), must be of the form +91-xxxxxxxxxx");
        info.uri = "tel:" + info.display;
    } else if (info.display.includes("@"))
        info.uri = "mailto:" + info.display;
    else
        throw Error("Invalid contact info: " + info.display + " (label: " + info.label + "), possibly missing 'http' or '+91' or '@' prefix.")

    return info
}


const callbacks = buildEntityCallbacks<GyanithEvent>({
    onIdUpdate({values}: EntityIdUpdateProps<GyanithEvent>): string {
        return values.name ? toKebabCase(values.name) : "name-of-event";
    },

    onPreSave: ({values}) => {
        if (values.people) {
            for (const person of values.people) {
                if (person.contacts)
                    person.contacts = person.contacts.map(contactURI);
            }
        }
        if (values.contacts) {
            values.contacts = values.contacts.map(contactURI);
        }
        return values;
    }
})

const contactInfoProperty = buildProperty<ContactInfo>(() => ({
    name: "Contact",
    dataType: "map",
    properties: {
        label: {
            name: "Name",
            dataType: "string",
            validation: {required: true},
        },
        display: {
            name: "Value",
            dataType: "string",
            validation: {required: true},
        },
        uri: {
            name: "URI",
            dataType: "string",
            readOnly: true,
            disabled: {
                disabledMessage: "This will be automatically updated by \"Value\" on save"
            }
        },
    }
}));

const
    personInfoProperty = buildProperty<PersonInfo>(() => ({
        name: "Person",
        dataType: "map",
        properties: {
            name: {
                name: "Name",
                dataType: "string",
                validation: {required: true},
            },
            img: {
                name: "Profile picture",
                dataType: "string",
                storage: {
                    acceptedFiles: ["image/png", "image/jpeg"],
                    storeUrl: true,
                    storagePath: "v2/event_people",
                }
            },
            contacts: {
                name: "Contacts",
                dataType: "array",
                of: contactInfoProperty,
            }
        }
    }));


const eventsCollection = buildCollection<GyanithEvent>({
    callbacks: callbacks,
    name: "Events",
    singularName: "Event",
    path: "events",
    group: "Main",
    properties: {
        name: {
            name: "Name",
            validation: {required: true, trim: true},
            dataType: "string"
        },
        type: {
            name: "Type",
            validation: {required: true},
            dataType: "string",
            enumValues: {
                "workshop": "Workshop",
                "tech": "Tech",
                "non tech": "Non-Tech",
                "guest talk": "Guest Talk",
                "pro show": "Proshow",
                "expo": "Expo"
            }
        },
        about: {
            name: "About",
            validation: {required: true, trim: true},
            dataType: "string",
            multiline: true,
        },
        rules: {
            name: "Rules",
            dataType: "string",
            validation: {trim: true},
            multiline: true,
        },
        mdContent: {
            name: "Markdown Content",
            dataType: "string",
            validation: {trim: true},
            markdown: true,
        },
        imgs: {
            name: "Images",
            dataType: "array",
            validation: {
                min: 1,
            },
            of: {
                name: "Cover Image",
                dataType: "string",
                validation: {required: true},
                storage: {
                    acceptedFiles: ["image/png", "image/jpeg"],
                    storeUrl: true,
                    storagePath: "v2/event_images",
                }
            }
        },
        status: {
            name: "Registration Status",
            dataType: "string",
            validation: {required: true},
            enumValues: asMap("Online payments are not available yet, please check back later"),
            defaultValue: "Online payments are not available yet, please check back later",
        },
        team: {
            name: "Team",
            dataType: "boolean",
            validation: {required: true},
        },
        fee: {
            name: "Price",
            dataType: "number",
            validation: {required: false, max: 5000},
            clearable: true,
        },
        peopleHeader: ({values}) => ({
            name: "People Header",
            dataType: "string",
            validation: {required: (values.people?.length ?? 0) > 0, trim: true},
        }),
        people: ({values}) => ({
            name: "People",
            dataType: "array",
            validation: {required: (values.peopleHeader != null)},
            of: personInfoProperty,
        }),
        contacts: {
            name: "Contacts for Queries",
            dataType: "array",
            of: contactInfoProperty,
        }
    }
})

export default function App() {

    const myAuthenticator: Authenticator<FirebaseUser> = useCallback(async ({user}) => {
        if (!user) return false;
        console.log(user);
        const snap = await getDocFromServer(doc(getFirestore(), "others", "cms-access"))
        const fullUsers = snap.data()?.full ?? [];
        const allow = fullUsers.includes(user.email);
        if(allow) console.log("User allowed: " + user.uid, user.email, user.displayName);
        else console.log("User denied: " + user.uid, user.email, user.displayName);
        return allow;
    }, []);

    console.log("Rendering App", process.env.NODE_ENV);

    return <FirebaseCMSApp
        name={"Gyanith 23"}
        authentication={myAuthenticator}
        collections={[eventsCollection]}
    />
}