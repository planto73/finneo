import {
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signInWithPopup,
} from "firebase/auth"
import { doc, getDoc, writeBatch } from "firebase/firestore"
import { getDownloadURL, ref, uploadBytes } from "firebase/storage"
import debounce from "lodash.debounce"
import Image from "next/image"
import { useCallback, useContext, useEffect, useState } from "react"
import toast from "react-hot-toast"
import Button from "../Components/Button"
import Checkmark from "../Components/Checkmark"
import Input from "../Components/Input"
import UploadFile from "../Components/UploadFile"
import { UserContext } from "../lib/context"
import { auth, firestore, googleAuth, storage } from "../lib/firebase"
import styles from "../styles/Enter.module.css"

function GoogleAuth() {
    const signInGoogle = () => {
        signInWithPopup(auth, googleAuth)
            .catch((error) => {
                const errorCode = error.code
                if (
                    errorCode === "auth/popup-closed-by-user" ||
                    errorCode === "auth/cancelled-popup-request"
                ) {
                    toast.error("Popup Closed")
                } else {
                    toast.error("Failed to sign in")
                }
            })
            .then(() => {
                toast.success("Signed in!")
            })
    }
    return (
        <>
            <span className={styles["auth-title"]}>OR</span>
            <div className={styles["auth-root"]}>
                <div
                    className={styles["auth-container"]}
                    onClick={signInGoogle}
                >
                    <div className={styles["auth-img"]}>
                        <Image
                            src="/google.png"
                            alt="google"
                            height="100%"
                            width="100%"
                        ></Image>
                    </div>
                    <p className={styles["auth-text"]}>Continue using Google</p>
                </div>
            </div>
        </>
    )
}

function SignIn({ func }) {
    const [email, setEmail] = useState("")
    const [password, SetPassword] = useState("")
    const [passwordShown, setPasswordShown] = useState(false)

    const signInEmail = () => {
        signInWithEmailAndPassword(auth, email, password)
            .then(() => {
                toast.success("Signed in!")
            })
            .catch((error) => {
                const errorCode = error.code
                if (errorCode === "auth/invalid-email") {
                    toast.error("Invalid Email")
                } else if (errorCode === "auth/wrong-password") {
                    toast.error("Wrong Password")
                } else if (errorCode === "auth/user-not-found") {
                    toast.error("User not found")
                } else {
                    toast.error("Failed to sign in")
                }
            })
    }

    return (
        <>
            <span className={styles.title}>Sign In</span>
            <Input
                name="Email"
                func={(e) => {
                    setEmail(e.target.value)
                }}
            />
            <Input
                name="Password"
                func={(e) => {
                    SetPassword(e.target.value)
                }}
                password={!passwordShown}
            />
            <Checkmark
                func={() => {
                    setPasswordShown(!passwordShown)
                }}
            />
            <Button name="Sign In" func={signInEmail} />
            <span className={styles.signup} onClick={func}>
                Don't have an account? Sign Up!
            </span>
            <GoogleAuth />
        </>
    )
}

function SignUp({ func }) {
    const [email, setEmail] = useState("")
    const [password, SetPassword] = useState("")
    const [passwordShown, setPasswordShown] = useState(false)

    const signUp = async (e) => {
        e.preventDefault()

        createUserWithEmailAndPassword(auth, email, password)
            .then(() => {
                toast.success("Signed up!")
            })
            .catch((error) => {
                const errorCode = error.code
                if (errorCode === "auth/invalid-email") {
                    toast.error("Invalid Email")
                } else if (errorCode === "auth/weak-password") {
                    toast.error("Weak Password")
                } else if (errorCode === "auth/email-already-in-use") {
                    toast.error("Email already in use")
                } else {
                    toast.error("Failed to sign up")
                }
            })
    }

    return (
        <>
            <span className={styles.title}>Sign Up</span>
            <Input
                name="Email"
                func={(e) => {
                    setEmail(e.target.value)
                }}
            />
            <Input
                name="Password"
                func={(e) => {
                    SetPassword(e.target.value)
                }}
                password={!passwordShown}
            />
            <Checkmark
                func={() => {
                    setPasswordShown(!passwordShown)
                }}
            />
            <Button name="Sign Up" func={signUp} />
            <span className={styles.signup} onClick={func}>
                Already have an account? Sign in
            </span>
            <GoogleAuth />
        </>
    )
}

function ChooseUsername({ func }) {
    const [username, SetUsername] = useState("")
    const [isValid, setIsValid] = useState(false)

    const checkUsername = useCallback(
        debounce(async (username) => {
            if (username.length >= 3 && username.length <= 15) {
                const usernameRef = doc(firestore, "usernames", username)
                const usernameSnap = await getDoc(usernameRef)
                const exists = usernameSnap.exists()
                setIsValid(!exists)
            }
        }, 500),
        []
    )

    const usernameChange = (e) => {
        const val = e.target.value.toLowerCase()
        const re = /^(?=[a-zA-Z0-9._]{3,15}$)(?!.*[_.]{2})[^_.].*[^_.]$/

        if (val.length < 3 || val.length > 15) {
            SetUsername(val)
            setIsValid(false)
        }

        if (re.test(val)) {
            SetUsername(val)
            setIsValid(false)
            checkUsername(val)
        }
    }

    return (
        <>
            <span className={styles.title}>Choose Username</span>
            <Input
                name="Username"
                func={(e) => {
                    usernameChange(e)
                }}
            />
            <Button
                name="Choose Username"
                func={() => {
                    func(username)
                }}
                disabled={!isValid}
            />
        </>
    )
}

function ChoosePicture({ func, username }) {
    const { user } = useContext(UserContext)

    const [profilePic, setProfilePic] = useState(null)
    const [viewPic, setViewPic] = useState(null)

    useEffect(() => {
        if (profilePic) {
            const reader = new FileReader()
            reader.onloadend = () => {
                setViewPic(reader.result)
            }
            reader.readAsDataURL(profilePic[0])
        } else {
            setViewPic(null)
        }
    }, [profilePic])

    const checkExistingPic = async () => {
        if (user.photoURL) {
            const userDoc = doc(firestore, "users", user.uid)
            const usernameDoc = doc(firestore, "usernames", username)
            const batch = writeBatch(firestore)
            batch.set(userDoc, {
                username,
                photoURL: user.photoURL,
            })
            batch.set(usernameDoc, { uid: user.uid })

            await batch.commit().catch(() => {
                toast.error("Failed to set username")
                return
            })
            func(true)
        }
    }

    useEffect(() => {
        checkExistingPic()
    }, [])

    const uploadFile = async () => {
        //Upload to storage
        const file = Array.from(profilePic)[0]
        const extension = file.type.split("/")[1]

        const vidRef = ref(
            storage,
            `profiles/${auth.currentUser.uid}.${extension}`
        )
        const vidTask = await uploadBytes(vidRef, file)
        let url = await getDownloadURL(vidTask.ref)

        const batch = writeBatch(firestore)
        const userDoc = doc(firestore, `users/${user.uid}`)
        const usernameDoc = doc(firestore, `usernames/${username}`)

        batch.set(userDoc, {
            username,
            photoURL: url,
        })
        batch.set(usernameDoc, { uid: user.uid })

        await batch.commit().catch(() => {
            toast.error("Failed to create account")
            return
        })

        toast.success("Success!")
        func(true)
    }

    return (
        <>
            <span className={styles.title}>Choose Picture</span>
            <UploadFile
                name="Profile Picture"
                accept="image/*"
                func={(e) => {
                    setProfilePic(e.target.files)
                }}
            />
            <span className={styles.preview}>Preview:</span>
            <div className={styles["profile-preview"]}>
                <Image
                    src={viewPic || "/user.png"}
                    alt="profile"
                    width="200px"
                    height="200px"
                ></Image>
            </div>
            <Button name="Submit" func={uploadFile} disabled={!profilePic} />
        </>
    )
}

export default function enter() {
    //Need to progress pages if info was just entered or is stored in DB
    const {
        user,
        username: storedUsername,
        profilePicture: storedProfilePicture,
    } = useContext(UserContext)
    const [username, setUsername] = useState("")

    const [signUp, setSignUp] = useState(false)
    const [isProfilePicture, setIsProfilePicture] = useState(false)

    return (
        <main className={styles.root}>
            <div className={styles.container}>
                {user ? (
                    !username && !storedUsername ? (
                        <ChooseUsername func={setUsername} />
                    ) : !isProfilePicture && !storedProfilePicture ? (
                        <ChoosePicture
                            func={setIsProfilePicture}
                            username={username}
                        />
                    ) : (
                        <p className={styles["signed-in-text"]}>
                            Already Signed In!
                        </p>
                    )
                ) : signUp ? (
                    <SignUp func={() => setSignUp(false)} />
                ) : (
                    <SignIn func={() => setSignUp(true)} />
                )}
            </div>
        </main>
    )
}
