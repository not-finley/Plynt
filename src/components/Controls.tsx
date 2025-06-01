interface ControlsProps {
    value: number;
    setValue: React.Dispatch<React.SetStateAction<number>>;
    modelValue: number;
    setModelValue: React.Dispatch<React.SetStateAction<number>>;
}

const Controls = ({ value, setValue, modelValue, setModelValue }: ControlsProps) => {
    return (
        <div className='bg-zinc-800 border border-zinc-700 p-4 rounded-xl shadow-lg items-center justify-center z-10 text-center'>
            <h2>Controls</h2>
            <div className="flex flex-col gap-2 ">
                <select
                    value={value}
                    onChange={e => setValue(Number(e.target.value))}
                    className="bg-zinc-700 text-white p-2 text-sm rounded-md mt-2"
                >
                    <option value="0">Rendered</option>
                    <option value="1">UV's</option>
                    <option value="2">Checker</option>
                </select>
                <select
                    value={modelValue}
                    onChange={e => setModelValue(Number(e.target.value))}
                    className="bg-zinc-700 text-white p-2 text-sm rounded-md mt-2"
                >
                    <option value="0">Dragon</option>
                    <option value="1">Cube</option>
                    <option value="2">Suzanne_HighRes</option>
                    <option value="3">Suzanne</option>
                    <option value="4">Teapot</option>
                </select>
            </div>
        </div>
    );
};

export default Controls;