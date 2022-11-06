import moment from "moment"
import Image from "next/image"
import Link from "next/link"
import { useCallback, useEffect, useRef, useState } from "react"
import toast from "react-hot-toast"
import { firestore, fromMillis, toJSON } from "../lib/firebase"
import styles from "../styles/Feed.module.css"

function Video({
    width,
    id,
    author_id,
    title,
    thumbnailURL,
    views,
    createdAt,
}) {
    const vert = width <= 28
    const [author, setAuthor] = useState("User")
    const [authorPhotoURL, setAuthorPhotoURL] = useState(null)

    const getAuthorData = async () => {
        const authorQuery = firestore.collection("users").doc(author_id)
        let data = (await authorQuery.get()).data()
        setAuthor(data.username)
        setAuthorPhotoURL(data.photoURL)
    }

    useEffect(() => {
        getAuthorData()
    }, [])

    return (
        <Link href={`/watch/${id}`}>
            <div
                className={
                    vert
                        ? styles["vid-container-vert"]
                        : styles["vid-container"]
                }
            >
                <div className={styles.video}>
                    <Image src={thumbnailURL} alt="thumbnail" layout="fill" />
                </div>
                <div className={styles["info-container"]}>
                    <div
                        className={styles.profile}
                        style={{ display: vert ? "none" : "inline-block" }}
                    >
                        <Image
                            src={authorPhotoURL || "/user.png"}
                            alt="profile"
                            layout="fill"
                        ></Image>
                    </div>
                    <div className={styles["text-container"]}>
                        <h3
                            className={`${styles.title} ${
                                vert ? styles["title-vert"] : ""
                            }`}
                        >
                            {title}
                        </h3>
                        <h3
                            className={`${styles["misc-text"]} ${
                                vert ? styles["misc-text-vert"] : ""
                            }`}
                        >
                            {author}
                        </h3>
                        <h1
                            className={`${styles["misc-text"]} ${
                                vert ? styles["misc-text-vert"] : ""
                            }`}
                        >
                            {views} views • {createdAt}
                        </h1>
                    </div>
                </div>
            </div>
        </Link>
    )
}

export default function Feed({
    initialUploads,
    widthNum,
    LOAD_LIMIT,
    IN_LIMIT,
}) {
    let width = `${widthNum}vw`
    console.log(width)

    //newUploads and oldUploads is to keep both lists of uploads to not have to make unnecessary calls to the database
    const [newUploads, setNewUploads] = useState(initialUploads)
    const [oldUploads, setOldUploads] = useState([])
    const [uploads, setUploads] = useState(initialUploads)
    const [filterIsNew, setFilterIsNew] = useState(true)

    const [newEnd, setNewEnd] = useState(false)
    const [oldEnd, setOldEnd] = useState(false)

    useEffect(() => {
        if (initialUploads.length === 0) {
            setNewEnd(true)
            setOldEnd(true)
        }
    }, [])

    const onFilterChange = async () => {
        if (filterIsNew) {
            //Load old uploads on first time
            if (oldUploads.length === 0) {
                const uploadsQuery = firestore
                    .collectionGroup("uploads")
                    .orderBy("createdAt")
                    .limit(IN_LIMIT)
                const uploads = (await uploadsQuery.get()).docs.map(toJSON)
                setOldUploads(uploads)
                setUploads(uploads)
            } else {
                setUploads(oldUploads)
            }
        } else {
            setUploads(newUploads)
        }
        setFilterIsNew(!filterIsNew)
    }

    const loadMore = async () => {
        const last = uploads[uploads.length - 1]
        const cursor =
            typeof last.createdAt === "number"
                ? fromMillis(last.createdAt)
                : last.createdAt
        const uploadsQuerry = firestore
            .collectionGroup("uploads")
            .orderBy("createdAt", filterIsNew ? "desc" : "asc")
            .startAfter(cursor)
            .limit(LOAD_LIMIT)

        const new_uploads = await uploadsQuerry.get().catch(() => {
            toast.error("Failed to load more videos")
            return
        })
        new_uploads = new_uploads.docs.map((doc) => doc.data())

        setUploads([...uploads, ...new_uploads])
        if (filterIsNew) {
            setNewUploads([...newUploads, ...new_uploads])
        } else {
            setOldUploads([...oldUploads, ...new_uploads])
        }

        if (new_uploads.length === 0) {
            if (filterIsNew) {
                setNewEnd(true)
            } else {
                setOldEnd(true)
            }
        }
    }

    //Detect last video being visible
    const observer = useRef()
    const lastVid = useCallback((node) => {
        if ((filterIsNew && newEnd) || (!filterIsNew && oldEnd)) return
        if (observer.current) observer.current.disconnect()
        observer.current = new IntersectionObserver((entries) => {
            if (entries[0].isIntersecting) {
                loadMore()
            }
        })
        if (node) observer.current.observe(node)
    })

    return (
        <div className={styles.root} style={{ width }}>
            <button
                className={styles.filter}
                onClick={onFilterChange}
                disabled={filterIsNew}
            >
                New
            </button>
            <button
                className={styles.filter}
                onClick={onFilterChange}
                disabled={!filterIsNew}
            >
                Old
            </button>
            <div className={styles.feed}>
                {uploads.map((upload, index) => {
                    return (
                        <div
                            ref={index === uploads.length - 1 ? lastVid : null}
                            key={upload.id}
                        >
                            <Video
                                width={widthNum}
                                id={upload.id}
                                photoURL={upload.photoURL}
                                author_id={upload.author}
                                title={upload.title}
                                thumbnailURL={upload.thumbnailURL}
                                views={upload.views}
                                createdAt={moment(upload.createdAt).fromNow()}
                            />
                        </div>
                    )
                })}
            </div>
        </div>
    )
}
